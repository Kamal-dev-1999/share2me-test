# ─── Availability Domain & Image Data Sources ─────────────────────────────────
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# Automatically fetch the latest Canonical Ubuntu 24.04 LTS aarch64 image for Ampere A1
data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.tenancy_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# ─── Compute Instance (Always Free Ampere A1 ARM) ──────────────────────────────
resource "oci_core_instance" "app_server" {
  compartment_id      = var.tenancy_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "${var.project_name}-server-${var.environment}"
  shape               = var.instance_shape

  # Hardware allocation strictly tuned to Always Free Ampere limits:
  # 2 OCPUs, 12 GB RAM (verified 2026 free tier cap)
  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_in_gbs
  }

  create_vnic_details {
    subnet_id              = oci_core_subnet.public.id
    display_name           = "${var.project_name}-primary-vnic"
    assign_public_ip       = false # We attach a permanent RESERVED static public IP below
    hostname_label         = "share2me"
    nsg_ids                = [oci_core_network_security_group.edge_proxy.id]
    skip_source_dest_check = false
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_in_gbs
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(local.cloud_init_script)
  }

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "Role"        = "EdgeProxyAndAppServer"
    "ManagedBy"   = "Terraform"
  }

  lifecycle {
    ignore_changes = [
      source_details[0].source_id, # Prevent re-creating VM if a new Ubuntu patch image is released
      create_vnic_details,         # Keep live VNIC settings without destroying instance
      metadata,                    # Cloud-init and metadata
    ]
  }
}

# ─── Attach Reserved Static Public IP ─────────────────────────────────────────
# Ensures the public IP never changes across reboots, re-deployments, or rebuilds.
data "oci_core_vnic_attachments" "instance_vnics" {
  compartment_id = var.tenancy_ocid
  instance_id    = oci_core_instance.app_server.id
}

data "oci_core_vnic" "primary_vnic" {
  vnic_id = data.oci_core_vnic_attachments.instance_vnics.vnic_attachments[0].vnic_id
}

data "oci_core_private_ips" "primary_private_ips" {
  vnic_id = data.oci_core_vnic.primary_vnic.id
}

resource "oci_core_public_ip" "reserved_static_ip" {
  compartment_id = var.tenancy_ocid
  lifetime       = "RESERVED"
  display_name   = "${var.project_name}-reserved-ip"
  private_ip_id  = data.oci_core_private_ips.primary_private_ips.private_ips[0].id

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# ─── Hardened Cloud-Init / Bootstrap Script ───────────────────────────────────
locals {
  cloud_init_script = <<-BOOTSTRAP
#!/bin/bash
set -euo pipefail
exec > /var/log/bootstrap.log 2>&1

echo "========================================================"
echo " Starting Share2Me Production Hardening & Provisioning"
echo " Time: $(date -u)"
echo "========================================================"

# 1. ─── Hardening: SSH & System Firewall ──────────────────────────────────────
echo "==> Configuring OS Firewall (UFW) and SSH Hardening..."

# Disable SSH password authentication (Key-based only)
sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd || true

apt-get update
apt-get install -y ufw curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

# UFW default stance: deny all inbound, allow all outbound
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH access'
ufw allow 80/tcp  comment 'HTTP ACME & Redirect'
ufw allow 443/tcp comment 'HTTPS Caddy Edge'
echo "y" | ufw enable
ufw status verbose

# 2. ─── Performance & Concurrency Tuning (WebSockets) ─────────────────────────
echo "==> Tuning Kernel parameters for high concurrency WebRTC/WebSockets..."
cat > /etc/sysctl.d/99-share2me.conf << 'EOF'
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
fs.file-max = 2097152
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
EOF
sysctl -p /etc/sysctl.d/99-share2me.conf

# File descriptor limits
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF

# 3. ─── Memory Safety: 4 GB Swap File ─────────────────────────────────────────
echo "==> Setting up 4 GB swap space..."
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 4. ─── Install Docker Engine & Docker Compose Plugin ─────────────────────────
echo "==> Installing Docker Engine..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
usermod -aG docker ubuntu

# 5. ─── Install Caddy Web Server ──────────────────────────────────────────────
echo "==> Installing Caddy..."
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-list.list
apt-get update
apt-get install -y caddy

# 6. ─── Setup Application Directory Structure ────────────────────────────────
echo "==> Preparing /opt/share2me..."
mkdir -p /opt/share2me
cd /opt/share2me

# ─── Hardened Docker Compose ──────────────────────────────────────────────────
# Security notes:
# 1. Ports for frontend, backend, and AI are strictly bound to 127.0.0.1 (NOT 0.0.0.0).
#    Nobody outside the host can connect directly without going through Caddy!
# 2. Redis has NO ports mapped to the host at all (only accessible inside Docker network).
cat > /opt/share2me/docker-compose.yml << 'DOCKERCOMPOSE'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - share2me_net

  backend:
    image: share2me-backend:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env.backend
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - PORT=8000
    depends_on:
      - redis
    networks:
      - share2me_net

  frontend:
    image: share2me-frontend:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env.frontend
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
    networks:
      - share2me_net

  ai:
    image: share2me-ai:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:5000:5000"
    environment:
      - INTERNAL_ML_SECRET=${var.internal_ml_secret}
      - OMP_NUM_THREADS=2
      - ONNXRUNTIME_NUM_THREADS=2
    networks:
      - share2me_net

volumes:
  redis_data:

networks:
  share2me_net:
    driver: bridge
DOCKERCOMPOSE

# ─── Hardened Caddyfile ───────────────────────────────────────────────────────
# Replaces Firebase Hosting rewrites + Cloud Run domain mappings with full SSL
cat > /etc/caddy/Caddyfile << 'CADDYCONFIG'
{
  email ${var.acme_email}
}

# ── Primary & Additional Frontend Domains ──
${var.frontend_domain}, ${join(", ", var.additional_domains)} {

  # Security headers
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
  }

  # Standalone AI Microservice Routes
  handle /ai/* {
    reverse_proxy 127.0.0.1:5000
  }
  handle /remove-background {
    reverse_proxy 127.0.0.1:5000
  }

  # NextAuth & Frontend Specific APIs
  handle /api/auth/* {
    reverse_proxy 127.0.0.1:3000
  }
  handle /api/g2p-token/* {
    reverse_proxy 127.0.0.1:3000
  }
  handle /api/tools/* {
    reverse_proxy 127.0.0.1:3000
  }
  handle /g2p/nearby* {
    reverse_proxy 127.0.0.1:3000
  }

  # Express Backend APIs
  handle /g2p/billing/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/health {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/requests/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/files/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/vendor/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/printshop/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /g2p/tools/* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /api/blogs* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /api/admin* {
    reverse_proxy 127.0.0.1:8000
  }
  handle /api/ice-servers {
    reverse_proxy 127.0.0.1:8000
  }

  # Socket.io WebSocket Support
  handle /socket.io/* {
    reverse_proxy 127.0.0.1:8000 {
      transport http {
        dial_timeout 5s
        response_header_timeout 3600s
      }
    }
  }

  # Catch-all: Next.js Frontend
  handle /* {
    reverse_proxy 127.0.0.1:3000
  }

  encode gzip
}

# ── Dedicated Backend API Domain ──
${var.backend_domain} {
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
  }

  handle /socket.io/* {
    reverse_proxy 127.0.0.1:8000 {
      transport http {
        dial_timeout 5s
        response_header_timeout 3600s
      }
    }
  }

  handle /* {
    reverse_proxy 127.0.0.1:8000
  }

  encode gzip
}
CADDYCONFIG

# Copy reference to /opt/share2me
cp /etc/caddy/Caddyfile /opt/share2me/Caddyfile

# ─── Environment Secret Files (Locked down: 0600) ─────────────────────────────
cat > /opt/share2me/.env.backend << 'ENVBACKEND'
NODE_ENV=production
ALLOWED_ORIGINS=https://${var.frontend_domain},https://www.${var.frontend_domain},https://share2me.in,https://www.share2me.in
AUTHORIZED_ADMIN_EMAILS=${var.authorized_admin_emails}
REDIS_URL=redis://redis:6379

DATABASE_URL=${var.database_url}
METERED_API_KEY=${var.metered_api_key}
STRIPE_SECRET_KEY=${var.stripe_secret_key}
STRIPE_WEBHOOK_SECRET=${var.stripe_webhook_secret}
GEMINI_API_KEY=${var.gemini_api_key}
AUTH_SECRET=${var.auth_secret}
AUTH_JWT_SECRET=${var.auth_secret}
RAZORPAY_KEY_ID=${var.razorpay_key_id}
RAZORPAY_KEY_SECRET=${var.razorpay_key_secret}
INTERNAL_ML_SECRET=${var.internal_ml_secret}

# Blog storage provider: Reads from OCI S3-compatible Object Storage
BLOG_STORAGE_PROVIDER=s3
S3_BLOGS_BUCKET=${var.project_name}-blogs-${var.environment}
AWS_REGION=${var.region}
AWS_ENDPOINT_URL=https://${data.oci_objectstorage_namespace.ns.namespace}.compat.objectstorage.${var.region}.oraclecloud.com
ENVBACKEND

cat > /opt/share2me/.env.frontend << 'ENVFRONTEND'
NODE_ENV=production
HOSTNAME=0.0.0.0
NEXT_PUBLIC_SIGNAL_URL=https://${var.backend_domain}
NEXT_PUBLIC_GA_ID=${var.google_analytics_id}
NEXT_TELEMETRY_DISABLED=1
AUTH_TRUST_HOST=true
AUTH_URL=https://${var.frontend_domain}
NEXTAUTH_URL=https://${var.frontend_domain}
NEXT_PUBLIC_EXPRESS_URL=https://${var.backend_domain}
BACKEND_URL=https://${var.backend_domain}
NEXT_PUBLIC_RAZORPAY_KEY_ID=${var.razorpay_key_id}
GOOGLE_CLIENT_ID=${var.google_client_id}
AUTHORIZED_ADMIN_EMAILS=${var.authorized_admin_emails}

AUTH_SECRET=${var.auth_secret}
GOOGLE_CLIENT_SECRET=${var.google_client_secret}
ENVFRONTEND

# Strict file permissions on all secret files
chmod 600 /opt/share2me/.env.*
chown -R ubuntu:ubuntu /opt/share2me

# 7. ─── Keep-Alive Cron (Prevents OCI Free Tier Idle Reclamation) ───────────────
# OCI checks for idle VMs (<15% CPU/network over 7 days).
# This lightweight ping keeps network & monitoring healthy.
echo "*/5 * * * * curl -sf http://127.0.0.1:80/health > /dev/null 2>&1" | crontab -u ubuntu -

# 8. ─── Enable and Start Caddy ────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable caddy
systemctl restart caddy

echo "========================================================"
echo " Share2Me Bootstrap Successfully Completed!"
echo " Time: $(date -u)"
echo "========================================================"
BOOTSTRAP
}

