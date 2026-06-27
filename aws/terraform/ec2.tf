# ─── Data Source: Latest ECS-Optimized AMI ────────────────────────────────────
# Automatically picks the latest Amazon Linux 2023 ECS-optimized AMI.
# This is the official image for EC2 ECS container hosts — it includes
# the ECS agent, Docker daemon, and AWS CLI pre-installed.

data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
}

# ─── EC2 User Data ────────────────────────────────────────────────────────────
# This script runs once on first boot to register the EC2 instance with our
# ECS cluster. The ECS agent reads ECS_CLUSTER from this file.
# We also tune kernel params for high WebSocket concurrency.
#
# NOTE: The heredoc must NOT be indented — base64encode encodes whitespace
# literally, so leading spaces would be written literally into the executed script.

locals {
  user_data = base64encode(templatestring(<<-USERDATA
#!/bin/bash
set -e

# Register with ECS cluster
echo "ECS_CLUSTER=${cluster_name}" >> /etc/ecs/ecs.config

# Increase open file descriptors for 2000+ concurrent WebSocket connections
cat >> /etc/security/limits.conf << LIMITS
*    soft nofile 65535
*    hard nofile 65535
root soft nofile 65535
root hard nofile 65535
LIMITS

# Tune TCP for high connection counts
cat >> /etc/sysctl.conf << SYSCTL
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
SYSCTL
sysctl -p

echo "ECS instance initialization complete."
USERDATA
  , { cluster_name = aws_ecs_cluster.main.name }))
}

# ─── Launch Template ──────────────────────────────────────────────────────────
resource "aws_launch_template" "ecs_host" {
  name_prefix   = "${var.project_name}-ecs-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.ec2_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ecs_host.id]
  }

  user_data = local.user_data

  monitoring {
    enabled = false # Set to true only if you want per-minute CloudWatch metrics (has cost)
  }

  # Only set key_name if a key pair name was provided — skip SSH access if not needed.
  # Bug fix: dynamic "key_name" is invalid HCL — key_name is a string attribute, not a block.
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

# ─── Auto Scaling Group for EC2 Host ──────────────────────────────────────────
# Manages the underlying EC2 instance(s) that run ECS tasks.
# max_size=2 allows the ECS Capacity Provider to spin up a second EC2 instance
# to host Task 2 during peak load — each instance stays within its 1GB RAM limit.

resource "aws_autoscaling_group" "ecs_host" {
  name                = "${var.project_name}-ecs-asg"
  vpc_zone_identifier = aws_subnet.public[*].id
  min_size            = 1
  max_size            = 2 # Allows ECS Capacity Provider to add a 2nd instance for Task 2
  desired_capacity    = 1

  launch_template {
    id      = aws_launch_template.ecs_host.id
    version = "$Latest"
  }

  # Protect instances from being terminated during scale-in while tasks drain
  termination_policies = ["OldestInstance"]

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
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
    ignore_changes        = [desired_capacity] # Let ECS Capacity Provider manage desired count
  }
}
