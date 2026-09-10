# ─── Firebase Hosting: Cloud Run Rewrite Gateway ──────────────────────────────
# Routes traffic from custom domain (share2me.in) to Cloud Run services:
# - /api/auth/** and /api/g2p-token/** -> Cloud Run Frontend (NextAuth & SSR)
# - /g2p/**, /api/blogs/**, /api/admin/**, /api/ice-servers -> Cloud Run Backend
# - /**                                 -> Cloud Run Frontend

resource "google_firebase_hosting_version" "default" {
  provider = google-beta
  site_id  = var.gcp_project_id

  config {
    # ── AI Microservice (Cloud Run share2me-ai) ──────────────────────────────
    rewrites {
      glob = "/ai/**"
      run {
        service_id = "share2me-ai"
        region     = var.gcp_region
      }
    }

    rewrites {
      glob = "/remove-background"
      run {
        service_id = "share2me-ai"
        region     = var.gcp_region
      }
    }

    # ── NextAuth & Frontend APIs (must be served by Next.js Frontend) ────────
    rewrites {
      glob = "/api/auth/**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }

    rewrites {
      glob = "/api/g2p-token/**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }

    rewrites {
      glob = "/api/tools/**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }

    rewrites {
      glob = "/g2p/nearby"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }

    rewrites {
      glob = "/g2p/nearby/**"
      run {
        service_id = google_cloud_run_v2_service.frontend.name
        region     = google_cloud_run_v2_service.frontend.location
      }
    }

    # ── Backend APIs (Express routes) ────────────────────────────────────────
    rewrites {
      glob = "/g2p/billing/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/health"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/requests/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/files/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/vendor/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/printshop/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/g2p/tools/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/api/blogs"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/api/blogs/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/api/admin"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/api/admin/**"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    rewrites {
      glob = "/api/ice-servers"
      run {
        service_id = google_cloud_run_v2_service.backend.name
        region     = google_cloud_run_v2_service.backend.location
      }
    }

    # ── All other traffic goes to Frontend ───────────────────────────────────
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
  message      = "Deploying precise Cloud Run rewrites for NextAuth and backend"
}
