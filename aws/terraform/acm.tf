# ─── ACM Certificate ──────────────────────────────────────────────────────────
# ACM certificates are completely free. This provisions a wildcard cert
# for share2.me and api.share2.me using DNS validation.

resource "aws_acm_certificate" "main" {
  domain_name = var.frontend_domain

  subject_alternative_names = [
    "*.${var.frontend_domain}", # Covers api.share2.me, www.share2.me etc.
  ]

  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true # Prevents downtime during cert renewal
  }

  tags = { Name = "${var.project_name}-cert" }
}

# ─── Certificate Validation ───────────────────────────────────────────────────
# This waits for the certificate to be validated via DNS.
# You MUST manually add the DNS CNAME records shown in the AWS console
# to your domain registrar (GoDaddy, Namecheap, Route53, etc.)
# before `terraform apply` can complete this step.

resource "aws_acm_certificate_validation" "main" {
  certificate_arn = aws_acm_certificate.main.arn

  # If your DNS is managed in Route 53, you can automate this.
  # If using an external registrar, add the CNAME records manually,
  # then let Terraform wait for propagation.
  timeouts {
    create = "10m"
  }
}
