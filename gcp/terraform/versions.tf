# ─── Required Providers ───────────────────────────────────────────────────────
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # ─── Remote State (optional — uncomment for team use) ────────────────────────
  # backend "gcs" {
  #   bucket = "share2me-terraform-state"
  #   prefix = "prod"
  # }
}
