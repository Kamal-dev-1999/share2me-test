# ─── VPC ──────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

# ─── Internet Gateway ─────────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project_name}-igw" }
}

# ─── Public Subnet ────────────────────────────────────────────────────────────
# We only need 1 subnet now — no ALB multi-AZ requirement.
# Using a single AZ keeps the EC2 instance co-located with its EBS root volume.

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[0]
  availability_zone       = var.availability_zones[0]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public" }
}

# ─── Route Table ──────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ─── Security Group: EC2 ECS Host ─────────────────────────────────────────────
# Traffic now arrives directly on the EC2 instance — no ALB in front.
# Caddy handles TLS on port 443, and uses port 80 for Let's Encrypt ACME challenges.

resource "aws_security_group" "ecs_host" {
  name        = "${var.project_name}-ecs-host-sg"
  description = "Allow HTTP/HTTPS from internet for Caddy, SSH for management"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP — required for Let's Encrypt ACME HTTP-01 challenge"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS — Caddy terminates TLS and proxies to containers"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ⚠️ Restrict SSH to your own IP in production: ["YOUR_IP/32"]
  ingress {
    description = "SSH management"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound (ECR pulls, ACME challenges, TURN API, npm etc.)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ecs-host-sg" }
}
