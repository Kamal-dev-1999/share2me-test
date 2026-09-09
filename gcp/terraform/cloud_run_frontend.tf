# ─── Cloud Run: Frontend (Next.js) ────────────────────────────────────────────
#
# Traffic flow:
#   Internet → Cloud Run HTTPS endpoint → Next.js standalone server (:3000)
#
# Cloud Run provides:
#   ✅ Auto-managed TLS certificates (no Caddy needed)
#   ✅ Global HTTP(S) load balancing (no ALB needed)
#   ✅ Auto-scaling 0→N based on request rate
#   ✅ Zero-downtime rolling deployments
#   ✅ Built-in DDoS protection at the edge
#
# The frontend is stateless — perfect for Cloud Run's scale-to-zero model.

resource "google_cloud_run_v2_service" "frontend" {
  name     = "${var.project_name}-frontend"
  location = var.gcp_region
  project  = var.gcp_project_id

  # Ingress: allow all traffic (public website)
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    # ── Scaling ────────────────────────────────────────────────────────────────
    scaling {
      min_instance_count = var.frontend_min_instances # 0 = scale to zero
      max_instance_count = var.frontend_max_instances # Cap at 5
    }

    # ── Execution Environment ──────────────────────────────────────────────────
    # gen2 = Cloud Run 2nd gen (based on gVisor+Linux) — better CPU/memory perf
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    # Max concurrent requests per instance
    max_instance_request_concurrency = var.frontend_concurrency

    # Service account with least privilege
    service_account = google_service_account.frontend.email

    # Request timeout: 60s (HTML page renders should be fast)
    timeout = "60s"

    containers {
      image = local.frontend_image

      # ── Resource Limits ──────────────────────────────────────────────────────
      resources {
        limits = {
          cpu    = var.frontend_cpu
          memory = var.frontend_memory
        }
        # CPU is always allocated (not just during requests) when min_instances > 0
        # For min_instances = 0, CPU is throttled between requests to save cost
        cpu_idle = var.frontend_min_instances == 0 ? true : false

        # Startup CPU boost: allocate extra CPU during container startup
        # so Next.js initializes faster (reduces cold start latency)
        startup_cpu_boost = true
      }

      # ── Ports ────────────────────────────────────────────────────────────────
      ports {
        container_port = 3000
        name           = "http1"
      }

      # ── Environment Variables ────────────────────────────────────────────────
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "DEPLOY_TAG"
        value = "v6-pdf-processor-patch-20260909"
      }
      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
      }
      env {
        name  = "NEXT_PUBLIC_SIGNAL_URL"
        value = "https://${var.backend_domain}"
      }
      env {
        name  = "NEXT_PUBLIC_GA_ID"
        value = var.google_analytics_id
      }
      env {
        name  = "NEXT_TELEMETRY_DISABLED"
        value = "1"
      }

      # ── NextAuth & App Configuration ──
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }
      env {
        name  = "AUTH_URL"
        value = "https://${var.frontend_domain}"
      }
      env {
        name  = "NEXTAUTH_URL"
        value = "https://${var.frontend_domain}"
      }
      env {
        name  = "NEXT_PUBLIC_EXPRESS_URL"
        value = "https://${var.backend_domain}"
      }
      env {
        name  = "BACKEND_URL"
        value = "https://${var.backend_domain}"
      }
      env {
        name  = "NEXT_PUBLIC_RAZORPAY_KEY_ID"
        value = var.razorpay_key_id
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "AUTHORIZED_ADMIN_EMAILS"
        value = var.authorized_admin_emails
      }

      # ── Secrets (injected from Secret Manager) ──
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
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_client_secret.secret_id
            version = "latest"
          }
        }
      }

      # ── Startup Probe ───────────────────────────────────────────────────────
      # Determines when the container is ready to receive traffic.
      # Next.js standalone server takes ~5-15s to start.
      startup_probe {
        http_get {
          path = "/"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10 # 5 + (10 × 5) = 55s max startup time
        timeout_seconds       = 5
      }

      # ── Liveness Probe ──────────────────────────────────────────────────────
      # Periodic health check. If this fails 3 times, Cloud Run restarts the container.
      liveness_probe {
        http_get {
          path = "/"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 5
      }
    }
  }

  # ── Traffic Routing ──────────────────────────────────────────────────────────
  # 100% traffic to the latest revision (rolling deployment).
  # For canary deployments, split traffic between revisions here.
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required_apis,
    google_artifact_registry_repository.docker,
    google_project_iam_member.frontend_secret_accessor,
    google_secret_manager_secret_version.auth_secret,
    google_secret_manager_secret_version.google_client_secret,
  ]

  lifecycle {
    # Ignore image tag changes — CI/CD updates the image directly via gcloud
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

# ─── IAM: Make Frontend Public ────────────────────────────────────────────────
# Allow unauthenticated access (it's a public website)
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Custom Domain Mapping (Deferred) ──────────────────────────────────────────
# Custom domains in asia-south1 are managed via DNS CNAME / Cloudflare proxy.

