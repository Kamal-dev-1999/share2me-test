# ─── OCI Authentication ────────────────────────────────────────────────────────
variable "tenancy_ocid" {
  description = "OCI Tenancy OCID (found under Tenancy Details in OCI Console)"
  type        = string
}

variable "user_ocid" {
  description = "OCI User OCID (found under User Profile in OCI Console)"
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the OCI API Private Key added to your user profile"
  type        = string
}

variable "private_key_path" {
  description = "Local path to the downloaded OCI API private key (.pem file)"
  type        = string
  default     = "./oci_api_key.pem"
}

variable "region" {
  description = "OCI Region for deployment (e.g. ap-mumbai-1, ap-hyderabad-1)"
  type        = string
  default     = "ap-mumbai-1"
}

# ─── General Project Info ─────────────────────────────────────────────────────
variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "share2me"
}

variable "environment" {
  description = "Environment name (e.g. prod, staging)"
  type        = string
  default     = "prod"
}

# ─── Domains & ACME ───────────────────────────────────────────────────────────
variable "frontend_domain" {
  description = "Primary frontend domain"
  type        = string
  default     = "share2.me"
}

variable "backend_domain" {
  description = "Primary backend API domain"
  type        = string
  default     = "api.share2.me"
}

variable "additional_domains" {
  description = "Additional domains to route through Caddy (e.g. share2me.in, www.share2.me)"
  type        = list(string)
  default     = ["www.share2.me", "share2me.in", "www.share2me.in"]
}

variable "acme_email" {
  description = "Email address for Let's Encrypt TLS certificate expiry notices"
  type        = string
  default     = "admin@share2.me"
}

# ─── Networking & Security ────────────────────────────────────────────────────
variable "vcn_cidr" {
  description = "CIDR block for the Virtual Cloud Network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet hosting the Caddy edge proxy"
  type        = string
  default     = "10.0.1.0/24"
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to connect via SSH (port 22). Default is open; restrict to your IP for maximum security."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_public_key" {
  description = "Public SSH key string to install on the Ubuntu instance for key-based authentication"
  type        = string
}

# ─── Always Free Compute Specs ────────────────────────────────────────────────
variable "instance_shape" {
  description = "Compute instance shape. VM.Standard.A1.Flex is the Always Free Ampere ARM shape."
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "Number of OCPUs (2 OCPUs is the Always Free limit for Ampere A1 as of 2026)"
  type        = number
  default     = 2
}

variable "instance_memory_in_gbs" {
  description = "RAM in GB (12 GB is the Always Free limit for Ampere A1 as of 2026)"
  type        = number
  default     = 12
}

variable "boot_volume_size_in_gbs" {
  description = "Boot volume size in GB. Always Free grants up to 200 GB across all volumes."
  type        = number
  default     = 100
}

# ─── Application Secrets & Configuration ──────────────────────────────────────
# Injected strictly into the isolated .env files on the server (chmod 600).
# Never exposed publicly.

variable "database_url" {
  description = "Supabase PostgreSQL connection string"
  type        = string
  sensitive   = true
  default     = ""
}

variable "metered_api_key" {
  description = "Metered TURN server API key for ICE server credentials"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret API key"
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

variable "gemini_api_key" {
  description = "Google Gemini API key for automated blog generation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "pollinations_api_key" {
  description = "Pollinations FLUX image generation API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_secret" {
  description = "NextAuth / JWT encryption secret shared between frontend and backend"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "razorpay_key_id" {
  description = "Razorpay Key ID"
  type        = string
  default     = ""
}

variable "razorpay_key_secret" {
  description = "Razorpay Key Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "authorized_admin_emails" {
  description = "Comma-separated list of authorized administrator emails"
  type        = string
  default     = "kamaltripathi1431@gmail.com,admin@share2.me,rishabh@share2.me"
}

variable "internal_ml_secret" {
  description = "Shared secret between Express backend and standalone AI microservice"
  type        = string
  sensitive   = true
  default     = "dc89162ed90f970e58c0f77d214ae497ad396fc0afa580e3210312dcf97305fb"
}

variable "google_analytics_id" {
  description = "Google Analytics Measurement ID"
  type        = string
  default     = "G-CCBEZ2KK0S"
}

variable "smtp_host" {
  description = "SMTP mail server host"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP mail server port"
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP mail server username"
  type        = string
  default     = ""
}

variable "smtp_pass" {
  description = "SMTP mail server password"
  type        = string
  sensitive   = true
  default     = ""
}

