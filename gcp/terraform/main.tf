# ─── GCP Provider Configuration ───────────────────────────────────────────────
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# ─── Enable Required APIs ─────────────────────────────────────────────────────
# These APIs must be active before any resources can be created.
# Terraform will enable them automatically on first apply.

resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",              # Cloud Run
    "artifactregistry.googleapis.com",  # Artifact Registry (container images)
    "secretmanager.googleapis.com",     # Secret Manager
    "vpcaccess.googleapis.com",        # Serverless VPC Access (Redis)
    "redis.googleapis.com",            # Memorystore Redis
    "compute.googleapis.com",          # Compute Engine (networking, Cloud Armor)
    "monitoring.googleapis.com",       # Cloud Monitoring
    "logging.googleapis.com",          # Cloud Logging
    "iam.googleapis.com",              # IAM
    "iamcredentials.googleapis.com",   # IAM Credentials (Workload Identity)
    "cloudresourcemanager.googleapis.com",
  ])

  project                    = var.gcp_project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}
