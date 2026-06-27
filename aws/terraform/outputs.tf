# ─── ALB DNS Name ─────────────────────────────────────────────────────────────
output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer. Point your domain CNAME records here."
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "The hosted zone ID of the ALB, needed for Route 53 alias records."
  value       = aws_lb.main.zone_id
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

# ─── ECS Cluster ──────────────────────────────────────────────────────────────
output "ecs_cluster_name" {
  description = "Name of the ECS cluster."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service."
  value       = aws_ecs_service.app.name
}

# ─── TLS Certificate ──────────────────────────────────────────────────────────
output "acm_certificate_domain_validation_options" {
  description = "DNS records you must add to your domain registrar to validate the ACM certificate."
  value       = aws_acm_certificate.main.domain_validation_options
}

# ─── Quick Setup Guide ────────────────────────────────────────────────────────
output "next_steps" {
  description = "Post-apply checklist."
  value = <<-EOT
    ── Post-Deploy Checklist ───────────────────────────────────────
    1. ACM DNS Validation:
       Add the CNAME records from 'acm_certificate_domain_validation_options'
       to your domain registrar to validate SSL.

    2. Domain DNS:
       Point your domain records to the ALB:
         share2.me     CNAME → ${aws_lb.main.dns_name}
         api.share2.me CNAME → ${aws_lb.main.dns_name}

    3. Build & Push Docker Images:
       Run: ./aws/scripts/deploy.sh

    4. SSM Secrets:
       Update the METERED_API_KEY in SSM Parameter Store:
       aws ssm put-parameter \
         --name "/share2me/prod/METERED_API_KEY" \
         --value "your-actual-key" \
         --type SecureString \
         --overwrite

    5. Force ECS Deployment:
       aws ecs update-service \
         --cluster ${aws_ecs_cluster.main.name} \
         --service ${aws_ecs_service.app.name} \
         --force-new-deployment
    ────────────────────────────────────────────────────────────────
  EOT
}
