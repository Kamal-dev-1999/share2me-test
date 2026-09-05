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
      max_instance_count = var.frontend_max_instances  # Cap at 5
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
        name  = "PORT"
        value = "3000"
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
        failure_threshold     = 10   # 5 + (10 × 5) = 55s max startup time
        timeout_seconds       = 5
      }

      # ── Liveness Probe ──────────────────────────────────────────────────────
      # Detects hung processes — restarts the container if it fails.
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

# ─── Custom Domain Mapping ────────────────────────────────────────────────────
# Maps share2.me → Cloud Run frontend service.
# Cloud Run auto-provisions a managed SSL certificate for the domain.
#
# ⚠️ After apply, you must add the CNAME record shown in outputs to your DNS.

resource "google_cloud_run_domain_mapping" "frontend" {
  name     = var.frontend_domain
  location = var.gcp_region
  project  = var.gcp_project_id

  metadata {
    namespace = var.gcp_project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }

  depends_on = [google_cloud_run_v2_service.frontend]
}
