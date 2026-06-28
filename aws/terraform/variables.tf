# ─── General ──────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "ap-south-1" # Mumbai — closest to India users
}

variable "environment" {
  description = "Environment name (e.g. prod, staging)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name, used as a prefix for all resources"
  type        = string
  default     = "share2me"
}

# ─── Networking ───────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability Zones to deploy subnets in"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}

# ─── EC2 ──────────────────────────────────────────────────────────────────────
variable "ec2_instance_type" {
  description = "EC2 instance type for the ECS container host. t2.micro is Free Tier eligible."
  type        = string
  default     = "t2.micro"
}

variable "ec2_key_pair_name" {
  description = "Name of an existing EC2 Key Pair for SSH access (must be created in AWS console first)"
  type        = string
  default     = ""
}

# ─── ECS ──────────────────────────────────────────────────────────────────────
variable "ecs_task_desired_count" {
  description = "Number of ECS tasks to run (fixed at 1 — Caddy uses host ports 80/443)"
  type        = number
  default     = 1
}

# ─── Application ──────────────────────────────────────────────────────────────
variable "acme_email" {
  description = "Email address for Let's Encrypt expiry notifications (Caddy ACME)"
  type        = string
  default     = "admin@share2.me"
}

variable "frontend_image_tag" {
  description = "Docker image tag for the frontend container"
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Docker image tag for the backend container"
  type        = string
  default     = "latest"
}

# ─── Container Resources ──────────────────────────────────────────────────────
variable "frontend_cpu" {
  description = "CPU units reserved for the frontend container (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory (MB) reserved for the frontend container"
  type        = number
  default     = 256
}

variable "backend_cpu" {
  description = "CPU units reserved for the backend container"
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Memory (MB) reserved for the backend container"
  type        = number
  default     = 256
}

# ─── Application ──────────────────────────────────────────────────────────────
variable "frontend_domain" {
  description = "The public domain for the frontend (e.g. share2.me)"
  type        = string
  default     = "share2.me"
}

variable "backend_domain" {
  description = "The public domain for the backend API (e.g. api.share2.me)"
  type        = string
  default     = "api.share2.me"
}

variable "metered_api_key" {
  description = "API key for Metered TURN server (ICE credentials)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "allowed_origins" {
  description = "Comma-separated list of allowed CORS origins for the backend"
  type        = string
  default     = "https://share2.me,https://www.share2.me"
}

variable "google_analytics_id" {
  description = "Google Analytics Measurement ID (e.g., G-XXXXXXXXXX)"
  type        = string
  default     = ""
}
