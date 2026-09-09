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

# ── Auth Secret (JWT / NextAuth) ──
resource "google_secret_manager_secret" "auth_secret" {
  secret_id = "${var.project_name}-auth-secret"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "auth_secret" {
  count       = var.auth_secret != "" ? 1 : 0
  secret      = google_secret_manager_secret.auth_secret.id
  secret_data = var.auth_secret
}

# ── Google OAuth Client Secret ──
resource "google_secret_manager_secret" "google_client_secret" {
  secret_id = "${var.project_name}-google-client-secret"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "google_client_secret" {
  count       = var.google_client_secret != "" ? 1 : 0
  secret      = google_secret_manager_secret.google_client_secret.id
  secret_data = var.google_client_secret
}

# ── Razorpay Key Secret ──
resource "google_secret_manager_secret" "razorpay_key_secret" {
  secret_id = "${var.project_name}-razorpay-key-secret"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "razorpay_key_secret" {
  count       = var.razorpay_key_secret != "" ? 1 : 0
  secret      = google_secret_manager_secret.razorpay_key_secret.id
  secret_data = var.razorpay_key_secret
}

# ── Cloudflare R2 Access Key ID & Secret ──
resource "google_secret_manager_secret" "r2_access_key_id" {
  secret_id = "${var.project_name}-r2-access-key-id"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "r2_access_key_id" {
  count       = var.r2_access_key_id != "" ? 1 : 0
  secret      = google_secret_manager_secret.r2_access_key_id.id
  secret_data = var.r2_access_key_id
}

resource "google_secret_manager_secret" "r2_secret_access_key" {
  secret_id = "${var.project_name}-r2-secret-access-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "r2_secret_access_key" {
  count       = var.r2_secret_access_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.r2_secret_access_key.id
  secret_data = var.r2_secret_access_key
}

# ── SMTP Password ──
resource "google_secret_manager_secret" "smtp_pass" {
  secret_id = "${var.project_name}-smtp-pass"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "smtp_pass" {
  count       = var.smtp_pass != "" ? 1 : 0
  secret      = google_secret_manager_secret.smtp_pass.id
  secret_data = var.smtp_pass
}

# ── AWS S3 Credentials for Blogs ──
resource "google_secret_manager_secret" "aws_access_key_id" {
  secret_id = "${var.project_name}-aws-access-key-id"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "aws_access_key_id" {
  count       = var.aws_access_key_id != "" ? 1 : 0
  secret      = google_secret_manager_secret.aws_access_key_id.id
  secret_data = var.aws_access_key_id
}

resource "google_secret_manager_secret" "aws_secret_access_key" {
  secret_id = "${var.project_name}-aws-secret-access-key"
  project   = var.gcp_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "aws_secret_access_key" {
  count       = var.aws_secret_access_key != "" ? 1 : 0
  secret      = google_secret_manager_secret.aws_secret_access_key.id
  secret_data = var.aws_secret_access_key
}


