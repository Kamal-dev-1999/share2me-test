# ─── REMOVED: AWS ACM Certificate ────────────────────────────────────────────
# ACM is not used because TLS is now handled entirely by the Caddy sidecar
# container via its built-in Let's Encrypt ACME client.
#
# Caddy automatically:
#   1. Issues a certificate from Let's Encrypt on first startup
#   2. Stores it in /data (bind-mounted from /var/lib/caddy-data on the EC2 host)
#   3. Renews it automatically before expiry
#
# Requirements for Let's Encrypt to work:
#   - The EC2 instance must have a public IP (Elastic IP — see ec2.tf)
#   - Ports 80 and 443 must be open on the security group (see networking.tf)
#   - Your domain DNS A records must point to the Elastic IP BEFORE first start
#   - The acme_email variable must be set (used for expiry notifications only)
