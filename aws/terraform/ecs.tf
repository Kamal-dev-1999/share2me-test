# ─── ECS Cluster ──────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = { Name = "${var.project_name}-cluster" }
}

# ─── ECS Capacity Provider ────────────────────────────────────────────────────
# Connects ECS to the ASG so ECS can monitor capacity.
# Since Caddy binds host ports 80/443, only 1 task can run per EC2 instance.
# Task-level auto-scaling is therefore removed — scaling is at the infra level.

resource "aws_ecs_capacity_provider" "ec2" {
  name = "${var.project_name}-ec2-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs_host.arn
    managed_termination_protection = "DISABLED" # Only 1 instance — protection not applicable

    managed_scaling {
      status                    = "ENABLED"
      target_capacity           = 100
      minimum_scaling_step_size = 1
      maximum_scaling_step_size = 1
    }
  }

  tags = { Name = "${var.project_name}-capacity-provider" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = [aws_ecs_capacity_provider.ec2.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    base              = 1
    weight            = 1
  }
}

# ─── IAM: ECS Task Execution Role ─────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─── IAM: ECS EC2 Instance Role ───────────────────────────────────────────────
resource "aws_iam_role" "ecs_instance" {
  name = "${var.project_name}-ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${var.project_name}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance.name
}

# ─── CloudWatch Log Group ─────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 7

  tags = { Name = "${var.project_name}-logs" }
}

# ─── ECS Task Definition ──────────────────────────────────────────────────────
# Task contains 4 containers, all sharing the same network namespace (bridge mode):
#
#   ┌─────────────────────────────────────────────────────┐
#   │  ECS Task (bridge network)                          │
#   │                                                     │
#   │  [caddy :80/:443]  ──▶ localhost:3000 [frontend]   │
#   │                    ──▶ localhost:8000 [backend]     │
#   │  [redis :6379]          (used by backend adapter)  │
#   └─────────────────────────────────────────────────────┘
#
# CPU/Memory budget on t2.micro (1024 CPU, ~970 MB usable):
#   frontend : 256 CPU + 256 MB
#   backend  : 256 CPU + 256 MB
#   redis    : 128 CPU + 128 MB
#   caddy    :  64 CPU +  64 MB
#   ─────────────────────────────
#   total    : 704 CPU + 704 MB  ✓ (270 MB headroom for ECS agent + OS)

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-task"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  cpu    = 704
  memory = 704

  # Bind-mount the Caddyfile and Caddy data dir from the EC2 host.
  # The Caddyfile is written by user-data (ec2.tf) before containers start.
  # The caddy-data dir persists TLS certificates across container restarts
  # so Let's Encrypt rate limits are never hit.
  volume {
    name      = "caddy-config"
    host_path = "/etc/caddy"
  }

  volume {
    name      = "caddy-data"
    host_path = "/var/lib/caddy-data"
  }

  container_definitions = jsonencode([

    # ── Caddy (reverse proxy + TLS termination) ───────────────────────────────
    {
      name      = "caddy"
      image     = "caddy:2-alpine"
      essential = true
      cpu       = 64
      memory    = 64

      portMappings = [
        { containerPort = 80,  hostPort = 80,  protocol = "tcp" },
        { containerPort = 443, hostPort = 443, protocol = "tcp" }
      ]

      mountPoints = [
        { sourceVolume = "caddy-config", containerPath = "/etc/caddy",         readOnly = true  },
        { sourceVolume = "caddy-data",   containerPath = "/data",              readOnly = false }
      ]

      # Caddy won't start until the frontend and backend are healthy.
      # dependsOn ensures correct startup order.
      dependsOn = [
        { containerName = "frontend", condition = "HEALTHY" },
        { containerName = "backend",  condition = "HEALTHY" }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:80/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "caddy"
        }
      }
    },

    # ── Frontend (Next.js) ────────────────────────────────────────────────────
    {
      name      = "frontend"
      image     = "${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}"
      essential = true
      cpu       = var.frontend_cpu
      memory    = var.frontend_memory

      # No hostPort needed — Caddy reaches it via localhost within the task
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]

      environment = [
        { name = "NODE_ENV",                   value = "production" },
        { name = "NEXT_PUBLIC_SIGNAL_URL",     value = "https://${var.backend_domain}" },
        { name = "PORT",                       value = "3000" }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    },

    # ── Backend (Socket.io signaling) ─────────────────────────────────────────
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential = true
      cpu       = var.backend_cpu
      memory    = var.backend_memory

      portMappings = [{ containerPort = 8000, protocol = "tcp" }]

      environment = [
        { name = "NODE_ENV",       value = "production" },
        { name = "PORT",           value = "8000" },
        { name = "ALLOWED_ORIGINS", value = var.allowed_origins },
        { name = "REDIS_URL",      value = "redis://localhost:6379" }
      ]

      secrets = [{
        name      = "METERED_API_KEY"
        valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/share2me/prod/METERED_API_KEY"
      }]

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      # Backend depends on Redis being healthy before starting
      dependsOn = [{ containerName = "redis", condition = "HEALTHY" }]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    },

    # ── Redis (Socket.io adapter state store) ─────────────────────────────────
    {
      name      = "redis"
      image     = "redis:7-alpine"
      essential = false
      cpu       = 128
      memory    = 128

      portMappings = [{ containerPort = 6379, protocol = "tcp" }]

      command = [
        "redis-server",
        "--maxmemory",        "96mb",
        "--maxmemory-policy", "allkeys-lru",
        "--save",             "",
        "--appendonly",       "no"
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "redis-cli ping || exit 1"]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "redis"
        }
      }
    }
  ])

  tags = { Name = "${var.project_name}-task-definition" }
}

data "aws_caller_identity" "current" {}

# ─── ECS Service ──────────────────────────────────────────────────────────────
resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1

  # capacity_provider_strategy replaces launch_type
  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    base              = 1
    weight            = 1
  }

  # Rolling deployment — ECS starts the new task before stopping the old one.
  # With 1 desired task: max_percent=200 allows a 2nd task briefly during deploy.
  deployment_minimum_healthy_percent = 0   # Allow full stop when replacing
  deployment_maximum_percent         = 100 # Don't run 2 tasks simultaneously (port conflicts)

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution,
    aws_ecs_cluster_capacity_providers.main
  ]

  tags = { Name = "${var.project_name}-service" }
}

# NOTE: ECS task-level auto-scaling is intentionally omitted.
# Caddy binds host ports 80 and 443. A second task on the same EC2 instance
# would fail to start because those ports are already taken.
# The single-instance design handles 2000+ concurrent WebSocket users comfortably
# (see the ulimit/sysctl tuning in ec2.tf user-data).
