# ─── General ──────────────────────────────────────────────────────────────────
variable "gcp_project_id" {
  description = "GCP project ID (not project number)"
  type        = string
}

variable "gcp_region" {
  description = "GCP region for all resources"
  type        = string
  default     = "asia-south1" # Mumbai — closest to Indian users
}

variable "environment" {
  description = "Environment name (prod, staging)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name, used as prefix for all resources"
  type        = string
  default     = "share2me"
}

# ─── Domains ──────────────────────────────────────────────────────────────────
variable "frontend_domain" {
  description = "Public domain for the frontend (e.g. share2.me)"
  type        = string
  default     = "share2.me"
}

variable "backend_domain" {
  description = "Public domain for the backend API (e.g. api.share2.me)"
  type        = string
  default     = "api.share2.me"
}

variable "allowed_origins" {
  description = "Comma-separated CORS origins for the backend"
  type        = string
  default     = "https://share2.me,https://www.share2.me"
}

# ─── Container Image Tags ────────────────────────────────────────────────────
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

# ─── Cloud Run: Frontend Resources ───────────────────────────────────────────
variable "frontend_cpu" {
  description = "CPU allocation for frontend (e.g. '1' = 1 vCPU)"
  type        = string
  default     = "1"
}

variable "frontend_memory" {
  description = "Memory allocation for frontend (e.g. '512Mi')"
  type        = string
  default     = "512Mi"
}

variable "frontend_min_instances" {
  description = "Minimum instances for frontend (0 = scale to zero)"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum instances for frontend"
  type        = number
  default     = 5
}

variable "frontend_concurrency" {
  description = "Max concurrent requests per frontend instance"
  type        = number
  default     = 80
}

# ─── Cloud Run: Backend Resources ─────────────────────────────────────────────
variable "backend_cpu" {
  description = "CPU allocation for backend (e.g. '2' = 2 vCPU)"
  type        = string
  default     = "2"
}

variable "backend_memory" {
  description = "Memory allocation for backend (e.g. '2Gi')"
  type        = string
  default     = "2Gi"
}

variable "backend_min_instances" {
  description = "Minimum instances for backend (1 = always warm for WebSocket)"
  type        = number
  default     = 1
}

variable "backend_max_instances" {
  description = "Maximum instances for backend"
  type        = number
  default     = 3
}

variable "backend_concurrency" {
  description = "Max concurrent requests per backend instance (WebSocket connections)"
  type        = number
  default     = 250
}

# ─── Redis ────────────────────────────────────────────────────────────────────
variable "redis_enabled" {
  description = "Enable Memorystore Redis for Socket.io state sharing"
  type        = bool
  default     = true
}

variable "redis_memory_gb" {
  description = "Redis memory in GB (Basic tier)"
  type        = number
  default     = 1
}

variable "redis_version" {
  description = "Redis version for Memorystore"
  type        = string
  default     = "REDIS_7_2"
}

# ─── Networking ───────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC subnet"
  type        = string
  default     = "10.8.0.0/28"
}

variable "vpc_connector_cidr" {
  description = "CIDR for the Serverless VPC Access connector (/28 required)"
  type        = string
  default     = "10.8.0.16/28"
}

# ─── Application Secrets ─────────────────────────────────────────────────────
variable "metered_api_key" {
  description = "Metered TURN server API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key for payment processing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "database_url" {
  description = "Supabase PostgreSQL connection string"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Google Gemini API key for blog generation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_analytics_id" {
  description = "Google Analytics Measurement ID (e.g. G-XXXXXXXXXX)"
  type        = string
  default     = ""
}

# ─── GitHub Actions OIDC (Workload Identity Federation) ───────────────────────
variable "github_owner" {
  description = "GitHub repository owner (e.g. Kamal-dev-1999)"
  type        = string
  default     = "Kamal-dev-1999"
}

variable "github_repo" {
  description = "GitHub repository name (e.g. share2me-test)"
  type        = string
  default     = "share2me-test"
}

# ─── Cloud Armor ──────────────────────────────────────────────────────────────
variable "cloud_armor_enabled" {
  description = "Enable Cloud Armor WAF/DDoS protection"
  type        = bool
  default     = false # Disable by default — requires Global External ALB which costs extra
}

variable "rate_limit_threshold" {
  description = "Max requests per minute per IP before throttling"
  type        = number
  default     = 300
}

# ─── Monitoring ───────────────────────────────────────────────────────────────
variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = "kamaltripathi1431@gmail.com"
}

variable "acme_email" {
  description = "Email for Let's Encrypt / managed SSL notifications"
  type        = string
  default     = "kamaltripathi1431@gmail.com"
}
