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

# ─── Certificate Validation Records ───────────────────────────────────────────
# ACM generates unique CNAME records that must be added to your DNS zone to
# prove domain ownership. We output them to the console and create a local
# file so you can easily copy-paste them into your registrar's DNS settings.
#
# If your DNS is hosted in Route 53, uncomment the aws_route53_record block
# below to automate this entirely.

# locals {
#   domain_validation_options = {
#     for dvo in aws_acm_certificate.main.domain_validation_options :
#     dvo.domain_name => {
#       name   = dvo.resource_record_name
#       record = dvo.resource_record_value
#       type   = dvo.resource_record_type
#     }
#   }
# }
#
# resource "aws_route53_record" "cert_validation" {
#   for_each = local.domain_validation_options
#   zone_id  = var.route53_zone_id  # Add this to variables.tf if using Route 53
#   name     = each.value.name
#   type     = each.value.type
#   ttl      = 60
#   records  = [each.value.record]
# }

# ─── Certificate Validation Wait ──────────────────────────────────────────────
# Terraform waits here until ACM confirms the certificate is validated via DNS.
#
# ⚠️  IMPORTANT — Before running `terraform apply`, you MUST:
#     1. Run `terraform plan` first to see the certificate output
#     2. Run `terraform apply -target=aws_acm_certificate.main` to create ONLY the cert
#     3. Find the CNAME records in the AWS Console: ACM → Certificates → your cert
#        OR check the `acm_certificate_domain_validation_options` Terraform output
#     4. Add those CNAME records to your domain registrar's DNS settings
#     5. Wait ~5 minutes for DNS to propagate, then run `terraform apply` in full
#
# validation_record_fqdns wires up the explicit dependency between the cert
# and the DNS records so Terraform knows what to poll. If you are using an
# external registrar (not Route 53), pass the FQDNs once records are added.

resource "aws_acm_certificate_validation" "main" {
  certificate_arn = aws_acm_certificate.main.arn

  # If using Route 53 (uncomment the route53 block above):
  # validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "15m" # Increased from 10m to give DNS more time to propagate
  }
}
