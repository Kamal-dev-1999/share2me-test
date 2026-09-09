# ─── Firebase Hosting: Cloud Run Rewrite Gateway ──────────────────────────────
# Routes traffic from custom domain (share2me.in) to Cloud Run services:
# - /api/** and /g2p/** -> Cloud Run Backend (asia-south1)
# - /**                 -> Cloud Run Frontend (asia-south1)

resource "google_firebase_hosting_version" "default" {
  provider = google-beta
  site_id  = var.gcp_project_id

  config {
    rewrites {
      glob = "/api/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }
  }
}

resource "google_firebase_hosting_release" "default" {
  provider     = google-beta
  site_id      = var.gcp_project_id
  version_name = google_firebase_hosting_version.default.name
  message      = "Deploying Cloud Run rewrite to frontend and backend"
}
