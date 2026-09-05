# ─── Secret Manager ───────────────────────────────────────────────────────────
# Replaces AWS SSM Parameter Store. Secrets are injected into Cloud Run
# containers at runtime via environment variable references.
#
# Pricing: 6 active secret versions free/month, then $0.06/version/month.
# 10K access operations free/month. Well within free tier for this project.

# ── Secret Definitions ────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "metered_api_key" {
  secret_id = "${var.project_name}-metered-api-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "metered_api_key" {
  count       = var.metered_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.metered_api_key.id
  secret_data = var.metered_api_key
}

resource "google_secret_manager_secret" "stripe_secret_key" {
  secret_id = "${var.project_name}-stripe-secret-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "stripe_secret_key" {
  count       = var.stripe_secret_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.stripe_secret_key.id
  secret_data = var.stripe_secret_key
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  secret_id = "${var.project_name}-stripe-webhook-secret"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "stripe_webhook_secret" {
  count       = var.stripe_webhook_secret != "" ? 1 : 0
  secret      = google_secret_manager_secret.stripe_webhook_secret.id
  secret_data = var.stripe_webhook_secret
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.project_name}-database-url"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  count       = var.database_url != "" ? 1 : 0
  secret      = google_secret_manager_secret.database_url.id
  secret_data = var.database_url
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "${var.project_name}-gemini-api-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  count       = var.gemini_api_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}
