# ─── Cloud Run: Backend (Socket.io + G2P + Tools) ─────────────────────────────
#
# Traffic flow:
#   Internet → Cloud Run HTTPS → Node.js server (:8000)
#                                 ├── Socket.io (WebSocket signaling)
#                                 ├── G2P print routes
#                                 ├── Blog API (reads from GCS)
#                                 ├── Puppeteer (HTML→PDF)
#                                 ├── LibreOffice (document conversion)
#                                 └── Tesseract (OCR)
#
# This is the heaviest service — 2 vCPU + 2 GB RAM to accommodate:
#   - Chromium (Puppeteer) needs ~300-500 MB per render
#   - LibreOffice needs ~200 MB
#   - Tesseract OCR needs ~100 MB
#   - Node.js + Socket.io + Redis adapter: ~100 MB
#   - Headroom for concurrent requests: ~800 MB
#
# WebSocket considerations:
#   - Cloud Run natively supports WebSocket upgrade handshake
#   - Session affinity routes the same client to the same instance
#   - Redis adapter syncs Socket.io rooms across instances
#   - min_instances = 1 keeps at least one instance warm (no cold start for WS)

resource "google_cloud_run_v2_service" "backend" {
  name     = "${var.project_name}-backend"
  location = var.gcp_region
  project  = var.gcp_project_id

  # Ingress: allow all traffic (public API)
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    # ── Scaling ────────────────────────────────────────────────────────────────
    scaling {
      min_instance_count = var.backend_min_instances # 1 = always warm
      max_instance_count = var.backend_max_instances # Cap at 3
    }

    # ── Execution Environment ──────────────────────────────────────────────────
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    # Max concurrent WebSocket connections per instance.
    # Socket.io connections are long-lived, so each "request" is a persistent
    # connection consuming memory. 250 is conservative for 2 GB RAM.
    max_instance_request_concurrency = var.backend_concurrency

    # Service account with secret access
    service_account = google_service_account.backend.email

    # Request timeout: 3600s (1 hour) for WebSocket connections.
    # Cloud Run terminates idle WebSocket connections after this duration.
    # Socket.io has its own heartbeat (pingInterval/pingTimeout) to detect
    # dead connections well before this limit.
    timeout = "3600s"

    # ── Session Affinity ───────────────────────────────────────────────────────
    # Route the same client to the same instance (best-effort).
    # Critical for Socket.io: the HTTP polling fallback requires sticky sessions.
    # Even with WebSocket transport, affinity improves performance by keeping
    # the client's room state local to one instance.
    session_affinity = true

    # ── VPC Connector (for Redis, optional) ───────────────────────────────────
    dynamic "vpc_access" {
      for_each = google_vpc_access_connector.main
      content {
        connector = vpc_access.value.id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }

    containers {
      image = local.backend_image

      # ── Resource Limits ──────────────────────────────────────────────────────
      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }
        # Cloud Run automatically keeps CPU allocated during active requests and open
        # WebSocket connections. Setting cpu_idle = true allows the idle discount when
        # no requests/connections are active, saving over $150/month in idle 24/7 vCPU costs.
        cpu_idle = true

        startup_cpu_boost = true
      }

      # ── Ports ────────────────────────────────────────────────────────────────
      # Cloud Run uses HTTP/1.1 with WebSocket upgrade for Socket.io.
      # h2c (HTTP/2 cleartext) is NOT compatible with WebSocket upgrade.
      ports {
        container_port = 8000
        name           = "http1"
      }

      # ── Environment Variables ────────────────────────────────────────────────
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }
      env {
        name  = "AUTHORIZED_ADMIN_EMAILS"
        value = var.authorized_admin_emails
      }
      env {
        name  = "REDIS_URL"
        value = local.redis_url
      }
      env {
        name  = "BLOG_STORAGE_PROVIDER"
        value = "gcs"
      }
      env {
        name  = "GCS_BLOGS_BUCKET"
        value = google_storage_bucket.auto_blogs.name
      }

      # ── Secrets (injected from Secret Manager) ──────────────────────────────
      env {
        name = "METERED_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.metered_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_secret_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "STRIPE_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_webhook_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "AUTH_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.auth_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "RAZORPAY_KEY_ID"
        value = var.razorpay_key_id
      }
      env {
        name = "RAZORPAY_KEY_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.razorpay_key_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "R2_BUCKET_NAME"
        value = var.r2_bucket_name
      }
      env {
        name  = "R2_ACCOUNT_ID"
        value = var.r2_account_id
      }
      env {
        name = "R2_ACCESS_KEY_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.r2_access_key_id.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "R2_SECRET_ACCESS_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.r2_secret_access_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "SMTP_HOST"
        value = var.smtp_host
      }
      env {
        name  = "SMTP_PORT"
        value = var.smtp_port
      }
      env {
        name  = "SMTP_USER"
        value = var.smtp_user
      }
      env {
        name = "SMTP_PASS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.smtp_pass.secret_id
            version = "latest"
          }
        }
      }

      # ── Startup Probe ───────────────────────────────────────────────────────
      # Backend is heavier (Chromium, LibreOffice install) — allow more time.
      startup_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 12 # 10 + (12 × 5) = 70s max startup
        timeout_seconds       = 5
      }

      # ── Liveness Probe ──────────────────────────────────────────────────────
      liveness_probe {
        http_get {
          path = "/health"
          port = 8000
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 10
      }
    }
  }

  # ── Traffic Routing ──────────────────────────────────────────────────────────
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_artifact_registry_repository.docker,
    google_secret_manager_secret_version.metered_api_key,
    google_secret_manager_secret_version.stripe_secret_key,
    google_secret_manager_secret_version.stripe_webhook_secret,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.gemini_api_key,
    google_secret_manager_secret_version.auth_secret,
    google_secret_manager_secret_version.razorpay_key_secret,
    google_secret_manager_secret_version.r2_access_key_id,
    google_secret_manager_secret_version.r2_secret_access_key,
    google_secret_manager_secret_version.smtp_pass,
  ]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

# ─── IAM: Make Backend Public ─────────────────────────────────────────────────
# The backend API must be publicly accessible for:
#   - WebSocket connections from browsers
#   - Stripe webhook callbacks
#   - Admin portal API calls
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Custom Domain Mapping (Deferred) ──────────────────────────────────────────
# Custom domains in asia-south1 are managed via DNS CNAME / Cloudflare proxy.

