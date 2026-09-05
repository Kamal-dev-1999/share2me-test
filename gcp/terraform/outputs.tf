# ─── Outputs ──────────────────────────────────────────────────────────────────
# Values displayed after `terraform apply` — copy these into your DNS, CI/CD, etc.

# ── Cloud Run URLs ────────────────────────────────────────────────────────────
output "frontend_url" {
  description = "Cloud Run-assigned URL for the frontend (use custom domain in production)"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  description = "Cloud Run-assigned URL for the backend (use custom domain in production)"
  value       = google_cloud_run_v2_service.backend.uri
}

# ── Custom Domains ────────────────────────────────────────────────────────────
output "frontend_domain_records" {
  description = "DNS records to add for frontend custom domain"
  value       = google_cloud_run_domain_mapping.frontend.status
}

output "backend_domain_records" {
  description = "DNS records to add for backend custom domain"
  value       = google_cloud_run_domain_mapping.backend.status
}

# ── Artifact Registry ─────────────────────────────────────────────────────────
output "artifact_registry_url" {
  description = "Base URL for pushing Docker images"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "frontend_image_path" {
  description = "Full image path for frontend container"
  value       = local.frontend_image
}

output "backend_image_path" {
  description = "Full image path for backend container"
  value       = local.backend_image
}

# ── Cloud Storage ─────────────────────────────────────────────────────────────
output "blogs_bucket_name" {
  description = "GCS bucket name for auto-generated blogs"
  value       = google_storage_bucket.auto_blogs.name
}

output "blogs_bucket_url" {
  description = "GCS bucket URL"
  value       = google_storage_bucket.auto_blogs.url
}

# ── Redis ─────────────────────────────────────────────────────────────────────
output "redis_host" {
  description = "Memorystore Redis host (private IP)"
  value       = var.redis_enabled ? google_redis_instance.main[0].host : "disabled"
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = var.redis_enabled ? google_redis_instance.main[0].port : 0
}

output "redis_url" {
  description = "Full Redis URL for backend REDIS_URL env var"
  value       = local.redis_url
  sensitive   = false
}

# ── GitHub Actions OIDC ───────────────────────────────────────────────────────
output "workload_identity_provider" {
  description = "Workload Identity Provider resource name (use in GitHub Actions)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_service_account" {
  description = "Service account email for GitHub Actions (use in GitHub Actions)"
  value       = google_service_account.github_actions.email
}

# ── Networking ────────────────────────────────────────────────────────────────
output "vpc_network" {
  description = "VPC network name"
  value       = google_compute_network.main.name
}

output "vpc_connector" {
  description = "Serverless VPC Access connector name"
  value       = google_vpc_access_connector.main.name
}

# ── Quick Reference ───────────────────────────────────────────────────────────
output "deploy_commands" {
  description = "Quick reference commands for deploying updates"
  value       = <<-EOT

    ═══════════════════════════════════════════════════════════════════
    Share2Me GCP Deployment — Quick Reference
    ═══════════════════════════════════════════════════════════════════

    1. Authenticate Docker with Artifact Registry:
       gcloud auth configure-docker ${var.gcp_region}-docker.pkg.dev

    2. Build & push frontend:
       docker build -t ${local.frontend_image} ./frontend
       docker push ${local.frontend_image}

    3. Build & push backend:
       docker build -t ${local.backend_image} ./backend
       docker push ${local.backend_image}

    4. Deploy frontend:
       gcloud run deploy ${var.project_name}-frontend \
         --image=${local.frontend_image} \
         --region=${var.gcp_region}

    5. Deploy backend:
       gcloud run deploy ${var.project_name}-backend \
         --image=${local.backend_image} \
         --region=${var.gcp_region}

    6. View logs:
       gcloud run services logs read ${var.project_name}-frontend --region=${var.gcp_region}
       gcloud run services logs read ${var.project_name}-backend --region=${var.gcp_region}

    7. DNS: Add CNAME records as shown in frontend/backend_domain_records output
    ═══════════════════════════════════════════════════════════════════

  EOT
}
