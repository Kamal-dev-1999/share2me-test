# ─── Public Infrastructure Outputs ────────────────────────────────────────────

output "server_public_ip" {
  value       = oci_core_public_ip.reserved_static_ip.ip_address
  description = "Permanent Reserved Static Public IP. Point your DNS A-records here."
}

output "ssh_connection_command" {
  value       = "ssh -i <your-private-key-file> ubuntu@${oci_core_public_ip.reserved_static_ip.ip_address}"
  description = "SSH command to connect to the Ubuntu ARM instance"
}

output "object_storage_namespace" {
  value       = data.oci_objectstorage_namespace.ns.namespace
  description = "OCI Object Storage Namespace identifier"
}

output "blogs_bucket_name" {
  value       = oci_objectstorage_bucket.blogs.name
  description = "S3-compatible bucket name for blog storage"
}

output "s3_compatible_endpoint" {
  value       = "https://${data.oci_objectstorage_namespace.ns.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
  description = "S3-compatible endpoint URL for AWS SDK / generate_blog.js / AWS CLI"
}

output "dns_setup_instructions" {
  value       = <<-EOD
  ================================================================================
  1. DNS A-RECORDS TO UPDATE (Cloudflare or Domain Registrar):
     - ${var.frontend_domain}        IN A  ${oci_core_public_ip.reserved_static_ip.ip_address}
     - ${var.backend_domain}         IN A  ${oci_core_public_ip.reserved_static_ip.ip_address}
     - www.${var.frontend_domain}    IN A  ${oci_core_public_ip.reserved_static_ip.ip_address}
     - share2me.in                   IN A  ${oci_core_public_ip.reserved_static_ip.ip_address}
     - www.share2me.in               IN A  ${oci_core_public_ip.reserved_static_ip.ip_address}

  2. VERIFYING HOST PROVISIONING:
     ssh ubuntu@${oci_core_public_ip.reserved_static_ip.ip_address}
     tail -f /var/log/bootstrap.log
     sudo systemctl status caddy
     cd /opt/share2me && docker compose ps

  3. S3 CREDENTIALS FOR BLOG CRON:
     In OCI Console -> My Profile -> Customer Secret Keys -> Generate Secret Key
     Set the key ID and secret into your GitHub Secrets or backend .env.
  ================================================================================
  EOD
  description = "Post-deployment DNS and verification instructions"
}
