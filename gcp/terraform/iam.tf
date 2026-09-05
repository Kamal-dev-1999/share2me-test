# ─── Service Accounts ─────────────────────────────────────────────────────────
# Principle of Least Privilege: each Cloud Run service gets its own SA
# with only the permissions it needs.

# ── Frontend Service Account ─────────────────────────────────────────────────
resource "google_service_account" "frontend" {
  account_id   = "${var.project_name}-frontend"
  display_name = "Share2Me Frontend Cloud Run SA"
  project      = var.gcp_project_id
}

# Frontend only needs: read container images (Artifact Registry)
# Cloud Run automatically grants artifactregistry.reader to the service agent,
# but we add logging explicitly for observability.

resource "google_project_iam_member" "frontend_logging" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.frontend.email}"
}

resource "google_project_iam_member" "frontend_monitoring" {
  project = var.gcp_project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.frontend.email}"
}

# ── Backend Service Account ──────────────────────────────────────────────────
resource "google_service_account" "backend" {
  account_id   = "${var.project_name}-backend"
  display_name = "Share2Me Backend Cloud Run SA"
  project      = var.gcp_project_id
}

# Backend needs: read secrets, read/write GCS blogs, logging, monitoring
resource "google_project_iam_member" "backend_logging" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_monitoring" {
  project = var.gcp_project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_secret_accessor" {
  project = var.gcp_project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# ── GitHub Actions — Workload Identity Federation ─────────────────────────────
# Keyless authentication: GitHub Actions OIDC → GCP Workload Identity Pool
# No static service account keys needed. Much more secure than storing
# GCP_SA_KEY in GitHub Secrets.

resource "google_service_account" "github_actions" {
  account_id   = "${var.project_name}-github-ci"
  display_name = "Share2Me GitHub Actions CI/CD SA"
  project      = var.gcp_project_id
}

# GitHub Actions SA needs: push images, deploy Cloud Run, read/write GCS
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.gcp_project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_ar_writer" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  project = var.gcp_project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

# GitHub Actions Workload Identity Pool
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${var.project_name}-github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Workload Identity Pool for GitHub Actions OIDC"
  project                   = var.gcp_project_id

  depends_on = [google_project_service.required_apis]
}

# GitHub Actions OIDC Provider
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"
  project                            = var.gcp_project_id

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Only allow tokens from GitHub's OIDC issuer
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  # Restrict to your specific repository
  attribute_condition = "assertion.repository == '${var.github_owner}/${var.github_repo}'"
}

# Allow the GitHub OIDC identity to impersonate the CI service account
resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
}
