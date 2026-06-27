# ─── REMOVED: Application Load Balancer ──────────────────────────────────────
# The ALB has been replaced by a Caddy reverse-proxy sidecar container running
# inside the ECS task. Caddy handles TLS automatically via Let's Encrypt ACME
# (no ACM certificate needed). This eliminates the ~$16/month ALB cost.
#
# Traffic flow (old → new):
#   OLD: Internet → ALB (port 443) → target groups → containers
#   NEW: Internet → EC2:443 → Caddy container → localhost:3000 / localhost:8000
#
# Routing is now defined in: aws/caddy/Caddyfile
# The Caddyfile is written to the EC2 host by user-data (ec2.tf)
# and bind-mounted into the Caddy container at /etc/caddy/Caddyfile.
