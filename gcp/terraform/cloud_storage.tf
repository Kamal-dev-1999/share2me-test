# ─── Cloud Storage: Blog Data ─────────────────────────────────────────────────
# Replaces AWS S3 bucket `share2me-auto-blogs-prod`.
# Stores auto-generated blog JSON files read by the frontend at runtime.

resource "google_storage_bucket" "auto_blogs" {
  name          = "${var.project_name}-auto-blogs-${var.environment}"
  location      = var.gcp_region
  project       = var.gcp_project_id
  force_destroy = false # Prevent accidental deletion of blog data

  # Standard storage class — cheapest for frequently accessed small files
  storage_class = "STANDARD"

  # Uniform bucket-level access (recommended over per-object ACLs)
  uniform_bucket_level_access = true

  # Versioning: keep previous versions so we can recover from bad overwrites
  versioning {
    enabled = true
  }

  # Lifecycle: delete old versions after 30 days to save storage
  lifecycle_rule {
    condition {
      num_newer_versions = 3   # Keep at most 3 versions per object
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # CORS: allow the frontend to fetch blog data directly (if ever needed)
  cors {
    origin          = ["https://${var.frontend_domain}", "https://www.${var.frontend_domain}"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  labels = {
    project     = var.project_name
    environment = var.environment
    purpose     = "auto-blogs"
  }
}

# ─── IAM: Backend can read blogs ──────────────────────────────────────────────
resource "google_storage_bucket_iam_member" "backend_read_blogs" {
  bucket = google_storage_bucket.auto_blogs.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.backend.email}"
}

# ─── IAM: GitHub Actions can write blogs ──────────────────────────────────────
resource "google_storage_bucket_iam_member" "github_write_blogs" {
  bucket = google_storage_bucket.auto_blogs.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.github_actions.email}"
}
