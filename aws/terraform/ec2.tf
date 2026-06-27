#!/bin/bash
# ─── Data Source: Latest ECS-Optimized AMI ────────────────────────────────────
# Automatically picks the latest Amazon Linux 2023 ECS-optimized AMI.

data "aws_ami" "ecs_ami" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-ecs-hvm-2023.*-x86_64"]
  }
}

# ─── Elastic IP ───────────────────────────────────────────────────────────────
# A static public IP so your domain A records never need to change,
# even if the EC2 instance is replaced during an ASG rolling update.
# Elastic IPs are FREE while attached to a running instance.

resource "aws_eip" "ecs_host" {
  domain = "vpc"

  tags = { Name = "${var.project_name}-eip" }
}

# ─── IAM Policy: EC2 instance can associate its own Elastic IP ────────────────
# The EC2 instance self-associates the EIP at boot via user-data.
# This avoids a chicken-and-egg problem: Terraform can't associate an EIP with
# an ASG instance directly (ASGs create instances dynamically), so the instance
# does it itself using the AWS CLI.

resource "aws_iam_role_policy" "ecs_instance_eip" {
  name = "${var.project_name}-ecs-eip-policy"
  role = aws_iam_role.ecs_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ec2:AssociateAddress", "ec2:DescribeAddresses"]
      Resource = "*"
    }]
  })
}

# ─── EC2 User Data ────────────────────────────────────────────────────────────
# Runs on first boot:
#   1. Registers with ECS cluster
#   2. Associates the Elastic IP with this instance
#   3. Creates the Caddyfile that will be bind-mounted into the Caddy container
#   4. Tunes kernel params for 2000+ concurrent WebSocket connections

locals {
  user_data = base64encode(<<-USERDATA
#!/bin/bash
set -euo pipefail
exec > /var/log/user-data.log 2>&1

echo "=== Share2Me ECS Bootstrap ==="

# 1. Register with ECS cluster
echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config

# 2. Associate Elastic IP with this instance
# Fetch Instance ID using IMDSv2 (required by AL2023)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
aws ec2 associate-address \
  --instance-id "$INSTANCE_ID" \
  --allocation-id "${aws_eip.ecs_host.id}" \
  --region "${var.aws_region}" \
  --allow-reassociation
echo "Elastic IP ${aws_eip.ecs_host.public_ip} associated with $INSTANCE_ID"

# 3. Create Caddyfile for the Caddy sidecar container
# Caddy reads this at /etc/caddy/Caddyfile (bind-mounted from this path)
mkdir -p /etc/caddy /var/lib/caddy-data

cat > /etc/caddy/Caddyfile << 'CADDYFILE'
{
  # Let's Encrypt ACME — change to your email for expiry notifications
  email ${var.acme_email}

  # Rate limit protection: avoid hitting Let's Encrypt limits during testing
  # Uncomment the line below to use the staging CA (issues untrusted certs):
  # acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}

# Frontend — serves the Next.js app
${var.frontend_domain}, www.${var.frontend_domain} {
  reverse_proxy frontend:3000 {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }

  # Security headers
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}

# Backend — Socket.io signaling server
${var.backend_domain} {
  reverse_proxy backend:8000 {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}

    # WebSocket support (Socket.io requires this)
    transport http {
      keepalive 30s
      keepalive_idle_conns 100
    }
  }
}
CADDYFILE

chmod 644 /etc/caddy/Caddyfile
echo "Caddyfile written to /etc/caddy/Caddyfile"

# 4. Kernel tuning for 2000+ concurrent WebSocket connections
cat >> /etc/security/limits.conf << LIMITS
*    soft nofile 65535
*    hard nofile 65535
root soft nofile 65535
root hard nofile 65535
LIMITS

cat >> /etc/sysctl.conf << SYSCTL
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
SYSCTL
sysctl -p

echo "=== Bootstrap complete ==="
USERDATA
  )
}

# ─── Launch Template ──────────────────────────────────────────────────────────
resource "aws_launch_template" "ecs_host" {
  name_prefix   = "${var.project_name}-ecs-"
  image_id      = data.aws_ami.ecs_ami.id
  instance_type = var.ec2_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  network_interfaces {
    associate_public_ip_address = true
    subnet_id                   = aws_subnet.public.id
    security_groups             = [aws_security_group.ecs_host.id]
  }

  user_data = local.user_data

  monitoring {
    enabled = false
  }

  key_name = var.ec2_key_pair_name != "" ? var.ec2_key_pair_name : null

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name    = "${var.project_name}-ecs-host"
      Project = var.project_name
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─── Auto Scaling Group ───────────────────────────────────────────────────────
# Maintains exactly 1 EC2 instance. If the instance becomes unhealthy, the ASG
# automatically replaces it and user-data re-associates the Elastic IP.
# max_size = 1 keeps us firmly on the Free Tier (750 hrs/month).

resource "aws_autoscaling_group" "ecs_host" {
  name_prefix         = "${var.project_name}-ecs-asg-"
  vpc_zone_identifier = [aws_subnet.public.id]
  min_size            = 1
  max_size            = 1  # Fixed at 1 — Caddy on fixed ports can't co-exist with a 2nd task on the same host
  desired_capacity    = 1

  launch_template {
    id      = aws_launch_template.ecs_host.id
    version = "$Latest"
  }

  termination_policies = ["OldestInstance"]

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 0  # Allow full replacement (1 instance total)
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-ecs-host"
    propagate_at_launch = true
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = ""
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [desired_capacity]
  }
}
