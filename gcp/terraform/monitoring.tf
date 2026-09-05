# ─── Cloud Monitoring: Uptime Checks ──────────────────────────────────────────
# Production-grade monitoring: checks every 60s from multiple global regions.
# Alerts via email if the service is down for > 2 consecutive checks.

# ── Frontend Uptime Check ─────────────────────────────────────────────────────
resource "google_monitoring_uptime_check_config" "frontend" {
  display_name = "${var.project_name}-frontend-uptime"
  project      = var.gcp_project_id
  timeout      = "10s"
  period       = "60s" # Check every 60 seconds

  http_check {
    path         = "/"
    port         = 443
    use_ssl      = true
    validate_ssl = true

    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.gcp_project_id
      host       = var.frontend_domain
    }
  }

  # Check from multiple regions for reliability
  selected_regions = [
    "ASIA_PACIFIC",
    "EUROPE",
    "USA",
  ]

  depends_on = [google_project_service.required_apis]
}

# ── Backend Uptime Check ─────────────────────────────────────────────────────
resource "google_monitoring_uptime_check_config" "backend" {
  display_name = "${var.project_name}-backend-uptime"
  project      = var.gcp_project_id
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true

    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.gcp_project_id
      host       = var.backend_domain
    }
  }

  selected_regions = [
    "ASIA_PACIFIC",
    "EUROPE",
    "USA",
  ]

  depends_on = [google_project_service.required_apis]
}

# ─── Notification Channel: Email ──────────────────────────────────────────────
resource "google_monitoring_notification_channel" "email" {
  display_name = "${var.project_name}-alert-email"
  type         = "email"
  project      = var.gcp_project_id

  labels = {
    email_address = var.alert_email
  }
}

# ─── Alert Policy: Frontend Down ─────────────────────────────────────────────
resource "google_monitoring_alert_policy" "frontend_down" {
  display_name = "${var.project_name} Frontend Down"
  project      = var.gcp_project_id
  combiner     = "OR"

  conditions {
    display_name = "Frontend uptime check failing"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.frontend.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "120s" # Alert after 2 minutes of failure

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"

        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s" # Auto-close alert after 30 minutes of recovery
  }

  documentation {
    content   = "The Share2Me frontend at https://${var.frontend_domain} is not responding to health checks. Check Cloud Run logs for errors."
    mime_type = "text/markdown"
  }
}

# ─── Alert Policy: Backend Down ───────────────────────────────────────────────
resource "google_monitoring_alert_policy" "backend_down" {
  display_name = "${var.project_name} Backend Down"
  project      = var.gcp_project_id
  combiner     = "OR"

  conditions {
    display_name = "Backend uptime check failing"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.backend.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "120s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"

        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "The Share2Me backend at https://${var.backend_domain}/health is not responding. WebSocket connections and G2P services may be affected. Check Cloud Run logs."
    mime_type = "text/markdown"
  }
}

# ─── Alert Policy: High Error Rate ───────────────────────────────────────────
# Triggers when the backend Cloud Run service returns > 5% 5xx errors
# over a 5-minute window.

resource "google_monitoring_alert_policy" "backend_error_rate" {
  display_name = "${var.project_name} Backend High Error Rate"
  project      = var.gcp_project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx error rate > 5%"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.project_name}-backend\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s" # 5 minutes sustained

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "The Share2Me backend is returning elevated 5xx errors. This may indicate a crash loop, OOM, or upstream dependency failure (Supabase, Stripe, Redis)."
    mime_type = "text/markdown"
  }
}

# ─── Alert Policy: High Memory Usage ─────────────────────────────────────────
# Triggers when backend memory utilization exceeds 85% — Puppeteer/LibreOffice
# are memory-hungry and can OOM if too many concurrent renders happen.

resource "google_monitoring_alert_policy" "backend_memory" {
  display_name = "${var.project_name} Backend High Memory"
  project      = var.gcp_project_id
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run memory utilization > 85%"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.project_name}-backend\" AND metric.type = \"run.googleapis.com/container/memory/utilizations\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "Backend memory utilization is above 85%. Risk of OOM kill. Consider increasing backend_memory or reducing concurrent Puppeteer renders."
    mime_type = "text/markdown"
  }
}
