# Oracle Cloud Infrastructure (OCI) Always Free — End-to-End Migration Plan

This guide details the complete, zero-cost migration of the **Share2Me Backend** (Node.js, Socket.io, Puppeteer, LibreOffice, OCR, and Redis) from GCP Cloud Run to an **Oracle Cloud Infrastructure (OCI) Always Free** dedicated ARM instance.

---

## 1. Executive Summary & Zero-Cost Architecture

### Why Oracle Always Free?
- **Current GCP Cloud Run Cost**: ~₹1,567 / 8 days (~₹5,740 / month) due to persistent WebSockets keeping containers active 24/7.
- **Oracle Cloud Cost**: **₹0.00 / month forever**.
- **Performance Upgrade**:
  - GCP Cloud Run: 1 shared vCPU (throttled when idle), 1 GB RAM.
  - Oracle Cloud: **4 dedicated ARM Neoverse-N1 OCPUs, 24 GB RAM, 200 GB NVMe storage**.

### Component Topology
```
[User Browser / Vendor App]
            │
            ▼ (HTTPS / WSS on Port 443)
┌────────────────────────────────────────────────────────┐
│  Oracle Cloud VM (VM.Standard.A1.Flex — Ubuntu 24.04)  │
│  4 OCPUs (ARM64) | 24 GB RAM | 150 GB NVMe             │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Caddy Reverse Proxy (Auto Let's Encrypt SSL)     │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                              │
│       ┌─────────────────┴─────────────────┐            │
│       ▼                                   ▼            │
│  ┌─────────────────────────┐   ┌────────────────────┐  │
│  │ Node.js Backend         │   │ Redis (Alpine)     │  │
│  │ (Socket.io + Express    │◄─►│ (Socket.io adapter │  │
│  │  + Puppeteer + OCR)     │   │  & state store)    │  │
│  └─────────────────────────┘   └────────────────────┘  │
└────────────────────────────────────────────────────────┘
            │
            ▼
[External Services: Supabase Postgres | Cloudflare R2 | Gemini AI]
```

---

## 2. Oracle Cloud "Always Free" Maximum Specifications

Oracle provides these exact limits with **no expiration date**:

| Resource | Always Free Allowance | Recommended Allocation for Share2Me |
| :--- | :--- | :--- |
| **Compute Shape** | `VM.Standard.A1.Flex` (Ampere Altra) | 1 Instance: **4 OCPUs, 24 GB RAM** |
| **CPU Hours** | 3,000 OCPU hours / month | 4 OCPUs × 744 hrs = 2,976 hrs (100% Free) |
| **Memory Hours** | 18,000 GB hours / month | 24 GB × 744 hrs = 17,856 GB-hrs (100% Free) |
| **Boot Volume** | 200 GB total across tenancy | **150 GB** NVMe Boot Disk (Balanced tier) |
| **Egress Traffic** | **10 TB / month** | Plenty for 50,000+ DAU |
| **Public IPv4** | 1 Reserved / Ephemeral Public IP | 1 Reserved Public IP (Free) |
| **VCN & Subnets** | 1 Virtual Cloud Network + Gateways | 1 VCN + 1 Public Subnet + Internet Gateway |

---

## 3. Pre-Requisites & Registration Protocol

### A. Account Creation
1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
2. Select your **Home Region**:
   - Recommended: **India South (Hyderabad)** or **India West (Mumbai)** for lowest latency to Indian users (~20–40ms).
   - If ARM capacity is tight in India, choose **Singapore (ap-singapore-1)** (latency to India is only ~45–55ms and ARM capacity is abundant).
   - *Important*: You cannot change your Home Region later for Always Free resources.
3. Card Verification:
   - Use an international Visa or Mastercard (credit or debit).
   - Ensure "International Transactions" and "E-commerce transactions" are enabled on your card.
   - A temporary authorization of ₹75–₹100 is charged and immediately refunded.

### B. Pro-Tip: Upgrade to "Pay As You Go" (PAYG) Status
- After your account is active, go to **Billing > Upgrade to Pay As You Go**.
- **Why?**:
  1. Always Free accounts are subject to "Out of Capacity" queue delays for ARM instances. PAYG accounts get instant provisioning.
  2. PAYG accounts are **exempt from the 7-day idle instance reclamation policy**.
  3. **Zero Cost**: As long as you stay within the 4 OCPU / 24 GB / 200 GB disk limit, your invoice will be **₹0.00**.

---

## 4. Step-by-Step Provisioning in OCI Console

### Step 1: Create Virtual Cloud Network (VCN)
1. In the OCI Console search bar, type **Virtual Cloud Networks**.
2. Click **Start VCN Wizard** > Select **Create VCN with Internet Connectivity** > Click **Start VCN Wizard**.
3. Name: `share2me-vcn`.
4. Click **Next** > Click **Create**.

### Step 2: Open Ingress Ports (Firewall)
1. In your new VCN, click on **Default Security List for share2me-vcn**.
2. Click **Add Ingress Rules**:
   - **Rule 1 (HTTP)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `80`
     - Description: `HTTP for Let's Encrypt ACME verification`
   - **Rule 2 (HTTPS)**:
     - Source CIDR: `0.0.0.0/0`
     - IP Protocol: `TCP`
     - Destination Port Range: `443`
     - Description: `HTTPS for secure API and WebSockets`
3. Click **Add Ingress Rules**. (Port 22 for SSH is already open by default).

### Step 3: Launch the 4 OCPU / 24 GB RAM VM
1. Go to **Compute > Instances > Create Instance**.
2. **Name**: `share2me-production-backend`.
3. **Image and Shape**:
   - Image: Click **Change Image** > Select **Ubuntu 24.04 LTS (aarch64)**.
   - Shape: Click **Change Shape** > Select **Ampere (ARM Processor)** > Check `VM.Standard.A1.Flex`.
   - Set **OCPUs**: `4`.
   - Set **Memory (GB)**: `24`.
4. **Networking**:
   - Select `share2me-vcn`.
   - Subnet: `Public Subnet`.
   - Assign Public IPv4 Address: **Yes** (Automatically assign public IPv4).
5. **Add SSH Keys**:
   - Select **Generate a key pair for me** and click **Save Private Key** (e.g. `oracle_key.key`), OR upload your existing public SSH key.
6. **Boot Volume**:
   - Check **Specify a custom boot volume size**: Set to `150` GB (stays under 200 GB free limit).
7. Click **Create**. (The instance will provision in ~1–2 minutes).

---

## 5. Server Setup & Production Hardening

### Step 1: SSH into the Server
From your local terminal (Powershell or Bash):
```bash
ssh -i /path/to/oracle_key.key ubuntu@<YOUR_VM_PUBLIC_IP>
```

### Step 2: Configure Host Firewall (Ubuntu iptables)
Oracle's Ubuntu images have internal `iptables` rules that block ports 80 and 443 by default. Run these commands to open them:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Step 3: Install Docker Engine & Docker Compose
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow ubuntu user to run docker without sudo
sudo usermod -aG docker ubuntu
newgrp docker
```

---

## 6. Production Docker Deployment

Create a directory on the server:
```bash
mkdir -p ~/share2me-backend && cd ~/share2me-backend
```

### A. `docker-compose.prod.yml`
Save the following file as `docker-compose.prod.yml`:
```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: share2me-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - share2me-net

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: share2me-backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 8000
      ALLOWED_ORIGINS: "https://share2me.net,https://www.share2me.net"
      REDIS_URL: "redis://redis:6379"
    env_file:
      - .env.production
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://127.0.0.1:8000/ping', (r) => process.exit(r.statusCode === 200 ? 0 : 1))\""]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s
    networks:
      - share2me-net

  redis:
    image: redis:7-alpine
    container_name: share2me-redis
    restart: always
    command:
      - redis-server
      - --maxmemory
      - 512mb
      - --maxmemory-policy
      - allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - share2me-net

volumes:
  caddy_data:
  caddy_config:

networks:
  share2me-net:
    driver: bridge
```

### B. `Caddyfile` (Automatic SSL + WebSocket Reverse Proxy)
Save as `Caddyfile`:
```caddy
# Replace with your actual backend domain (e.g., api.share2me.net)
api.share2me.net {
    # Automatic Let's Encrypt HTTPS issuance & renewal
    encode zstd gzip

    # Reverse proxy all HTTP & WebSocket traffic to Node.js backend
    reverse_proxy backend:8000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

### C. `.env.production`
Save the backend secrets in `.env.production`:
```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres
AUTH_JWT_SECRET=your_auth_jwt_secret_here
R2_BUCKET_NAME=share2me-g2p-bucket
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_cloudflare_access_key_id
R2_SECRET_ACCESS_KEY=your_cloudflare_secret_access_key
METERED_API_KEY=your_metered_turn_api_key
GEMINI_API_KEY=your_gemini_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PRICE_ID=your_stripe_price_id
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

---

## 7. Launch & Verification Commands

1. **Build and start the stack**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

2. **Check status**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   All three containers (`share2me-backend`, `share2me-caddy`, `share2me-redis`) should show `healthy` or `running`.

3. **Check logs**:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f backend
   ```

4. **DNS Configuration**:
   - In Cloudflare or your DNS registrar, add an **A Record**:
     - Name: `api` (or whatever subdomain you chose in Caddyfile)
     - Target: `<YOUR_ORACLE_PUBLIC_IP>`
     - Proxy status: DNS only (gray cloud) or Proxied with WebSockets enabled.
   - Caddy will automatically detect incoming traffic on `api.share2me.net`, obtain a free Let's Encrypt SSL certificate, and serve HTTPS immediately.

5. **Update Frontend**:
   - In `frontend/.env.production` (or Cloud Run environment variables):
     ```env
     NEXT_PUBLIC_BACKEND_URL=https://api.share2me.net
     NEXT_PUBLIC_SIGNAL_URL=https://api.share2me.net
     ```
   - Redeploy frontend.

---

## 8. Anti-Reclamation & Reliability Check

1. **Systemd Auto-Restart on Boot**:
   Docker starts automatically on reboot with `restart: always`.
2. **Oracle Idle Reclamation Protection**:
   - With 2,000 DAU, CPU and memory usage will easily keep the VM active.
   - Upgrading your account to **Pay-As-You-Go** completely disables Oracle's idle reclamation checker while keeping all Always Free services 100% free.
3. **Monthly Billing Verification**:
   - Check **Cost Management > Cost Analysis** in OCI console weekly.
   - Total should remain: **₹0.00 / $0.00**.
