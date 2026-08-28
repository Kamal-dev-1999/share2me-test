# ─── Elastic IP ───────────────────────────────────────────────────────────────
output "elastic_ip" {
  description = "Static public IP of the EC2 instance. Point your domain A records HERE (not CNAME)."
  value       = aws_eip.ecs_host.public_ip
}

# ─── ECR Repository URLs ──────────────────────────────────────────────────────
output "frontend_ecr_url" {
  description = "ECR repository URL for the frontend image. Use this in your CI/CD pipeline."
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_url" {
  description = "ECR repository URL for the backend image. Use this in your CI/CD pipeline."
  value       = aws_ecr_repository.backend.repository_url
}

# ─── ECS ──────────────────────────────────────────────────────────────────────
output "ssm_vpc_id" {
  description = "Command to fetch the VPC ID from SSM"
  value       = "aws ssm get-parameter --name /share2me/${var.environment}/vpc_id --query Parameter.Value --output text"
}

output "auto_blogs_bucket_name" {
  description = "The name of the auto-generated blogs S3 bucket"
  value       = aws_s3_bucket.auto_blogs.bucket
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service."
  value       = aws_ecs_service.app.name
}

# ─── Post-Deploy Checklist ────────────────────────────────────────────────────
output "next_steps" {
  description = "Step-by-step post-apply setup guide."
  value = <<-EOT
    ── Post-Deploy Checklist ──────────────────────────────────────────
    1. Point DNS A records to the Elastic IP:
         share2.me     A → ${aws_eip.ecs_host.public_ip}
         www.share2.me A → ${aws_eip.ecs_host.public_ip}
         api.share2.me A → ${aws_eip.ecs_host.public_ip}

       ⚠️  DNS must propagate BEFORE the Caddy container starts.
          Caddy requests TLS certs from Let's Encrypt on first boot,
          which requires the domain to resolve to this IP.

    2. Set SSM secrets:
         aws ssm put-parameter \
           --name "/share2me/prod/METERED_API_KEY" \
           --value "your-key" \
           --type SecureString \
           --overwrite \
           --region ${var.aws_region}

    3. Build & push Docker images:
         bash aws/scripts/deploy.sh

    4. Verify Caddy TLS (may take 1-2 min on first boot):
         curl -I https://${var.frontend_domain}
         curl -I https://${var.backend_domain}/health

    5. Force ECS deployment after any code change:
         aws ecs update-service \
           --cluster ${aws_ecs_cluster.main.name} \
           --service ${aws_ecs_service.app.name} \
           --force-new-deployment
    ───────────────────────────────────────────────────────────────────
  EOT
}
