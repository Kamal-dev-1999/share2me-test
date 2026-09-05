# ─── Artifact Registry ────────────────────────────────────────────────────────
# GCP's managed Docker registry (replaces AWS ECR).
# Images are stored regionally for low-latency pulls by Cloud Run.

resource "google_artifact_registry_repository" "docker" {
  location      = var.gcp_region
  repository_id = "${var.project_name}-docker"
  description   = "Docker images for Share2Me frontend and backend"
  format        = "DOCKER"
  project       = var.gcp_project_id

  # Cleanup policy: keep only the last 5 tagged images per package.
  # Prevents storage bloat from CI/CD pushes.
  cleanup_policies {
    id     = "keep-last-5"
    action = "KEEP"

    most_recent_versions {
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  depends_on = [google_project_service.required_apis]
}

# ─── Local Values ─────────────────────────────────────────────────────────────
# Convenience references for image paths used by Cloud Run services.

locals {
  ar_prefix      = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker.repository_id}"
  frontend_image = "${local.ar_prefix}/frontend:${var.frontend_image_tag}"
  backend_image  = "${local.ar_prefix}/backend:${var.backend_image_tag}"
}
