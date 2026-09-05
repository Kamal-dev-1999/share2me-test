# ─── Memorystore Redis ────────────────────────────────────────────────────────
# Managed Redis for Socket.io adapter state sharing across Cloud Run instances.
# Basic tier = single node, no replication (sufficient for signaling state).
#
# Why Memorystore instead of a sidecar:
#   Cloud Run instances are ephemeral. Each instance gets its own container.
#   If you run Redis as a sidecar, each instance has its own isolated Redis,
#   defeating the purpose of shared state. Memorystore provides a single
#   shared Redis endpoint that all Cloud Run instances connect to.
#
# Cost: ~$35/month for 1 GB Basic tier in asia-south1.

resource "google_redis_instance" "main" {
  count = var.redis_enabled ? 1 : 0

  name           = "${var.project_name}-redis"
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_gb
  region         = var.gcp_region
  project        = var.gcp_project_id

  redis_version = var.redis_version

  # Connect to our VPC — Cloud Run reaches this via the VPC connector
  authorized_network = google_compute_network.main.id

  # Redis configuration tuned for Socket.io signaling state
  redis_configs = {
    maxmemory-policy = "allkeys-lru"    # Evict least-recently-used keys when full
    notify-keyspace-events = ""          # Disabled — not needed for adapter
  }

  # Maintenance window: Sunday 3 AM IST (Saturday 9:30 PM UTC)
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 21
        minutes = 30
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_compute_network.main,
  ]

  lifecycle {
    prevent_destroy = false # Allow destruction for dev/testing
  }
}

# ─── Local: Redis URL ─────────────────────────────────────────────────────────
# Construct the redis:// URL for the backend env var.
# Falls back to empty string if Redis is disabled (backend uses in-memory mode).

locals {
  redis_url = var.redis_enabled ? "redis://${google_redis_instance.main[0].host}:${google_redis_instance.main[0].port}" : ""
}
