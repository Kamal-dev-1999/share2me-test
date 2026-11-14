# Share2Me — Oracle Cloud Infrastructure (OCI) Always Free Stack

Production-grade, perpetually free cloud infrastructure for Share2Me v3.5 on Oracle Cloud Infrastructure (OCI), managed with Terraform.

---

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │            Oracle Cloud Infrastructure (OCI)            │
                    │               (ap-mumbai-1 / Home Region)               │
                    │                                                         │
                    │   ┌─────────────────────────────────────────────────┐   │
                    │   │  Reserved Static Public IP (Permanent)          │   │
                    │   └────────────────────────┬────────────────────────┘   │
                    │                            │ (Ports 80 / 443)           │
                    │                            ▼                            │
                    │   ┌─────────────────────────────────────────────────┐   │
                    │   │  Caddy Edge Reverse Proxy (Host Level)          │   │
                    │   │  Auto Let's Encrypt TLS · HSTS · WebSocket      │   │
                    │   │  Replaces Firebase Hosting Rewrites             │   │
                    │   └───────┬──────────────┬──────────────┬───────────┘   │
                    │           │              │              │               │
                    │           │ :3000        │ :8000        │ :5000         │
                    │           ▼              ▼              ▼               │
                    │   ┌──────────────┐┌──────────────┐┌──────────────┐      │
                    │   │ Next.js      ││ Express      ││ Standalone   │      │
                    │   │ Frontend     ││ Backend & WS ││ AI Service   │      │
                    │   │ (127.0.0.1)  ││ (127.0.0.1)  ││ (127.0.0.1)  │      │
                    │   └──────────────┘└──────┬───────┘└──────────────┘      │
                    │                          │                              │
                    │                          ▼ (Docker Network)             │
                    │                  ┌──────────────┐                       │
                    │                  │ Redis 7      │                       │
                    │                  │ (NO HOST PORT│                       │
                    │                  │  PUBLISHED)  │                       │
                    │                  └──────────────┘                       │
                    │                                                         │
                    │   ┌─────────────────────────────────────────────────┐   │
                    │   │  OCI Object Storage (share2me-blogs-prod)       │   │
                    │   │  10 GB Always Free · S3-Compatible API          │   │
                    │   │  NoPublicAccess · 30-day version lifecycle      │   │
                    │   └─────────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────────┘
```

---

## Cloud Security & Defense-in-Depth

This infrastructure follows a strict **zero-trust / defense-in-depth** security model:

1. **Granular Network Security Group (NSG):**
   - Ingress is restricted to **Port 80 (HTTP)** and **Port 443 (HTTPS)** for the public edge.
   - **Port 22 (SSH)** is configurable via `ssh_allowed_cidrs`.
   - **NO OTHER PORTS ARE OPEN TO THE INTERNET.**
2. **Localhost Binding for Containers:**
   - Next.js (port 3000), Express (port 8000), and AI (port 5000) are bound strictly to `127.0.0.1` on the VM host.
   - Even if external firewall rules fail, outside callers cannot reach the containers directly.
3. **Completely Isolated Redis:**
   - Redis has **NO host port published** at all. It exists exclusively inside the Docker bridge network (`share2me_net`).
4. **Private S3-Compatible Storage:**
   - The OCI Object Storage bucket is configured with `access_type = "NoPublicAccess"`.
   - Direct public listing or reading is completely blocked. Blog images and JSONs are streamed securely through the Express API proxy routes.
5. **OS & SSH Hardening:**
   - Password authentication over SSH is disabled (`PasswordAuthentication no`).
   - Ubuntu host firewall (`ufw`) enforces default-deny.
   - Secret files (`.env.backend`, `.env.frontend`) on the server are locked with `chmod 600`.

---

## Resource Sizing & Always Free Limits (2026 Caps)

| Resource | OCI Allocation | Always Free Limit | Cost |
|---|---|---|---|
| **Compute** | 1× `VM.Standard.A1.Flex` (2 OCPU, 12 GB RAM) | 2 OCPU / 12 GB RAM total | **$0.00** |
| **Boot Volume** | 100 GB Balanced Volume | 200 GB total across all volumes | **$0.00** |
| **Public IP** | 1× Reserved Static Public IPv4 | 1 Reserved IP attached to active VM | **$0.00** |
| **Object Storage** | 10 GB Standard Tier (`share2me-blogs-prod`) | 10 GB Standard S3-Compatible | **$0.00** |
| **Egress Bandwidth** | Up to 10 TB/month | 10 TB/month free | **$0.00** |
| **TLS Certificates** | Managed by Caddy via Let's Encrypt | Unlimited free certs | **$0.00** |

> [!TIP]
> **Upgrade to Pay-As-You-Go (PAYG):**
> Upgrading your OCI account to PAYG costs \$0 if you stay within these Always Free limits, but it **completely exempts** your tenancy from Oracle's idle instance reclamation policy and eliminates "out of host capacity" errors.

---

## Deployment Guide

### Prerequisites
1. [Terraform](https://developer.hashicorp.com/terraform/install) $\ge$ 1.5.0
2. An active Oracle Cloud account with your Home Region set (e.g. `ap-mumbai-1`)
3. An OCI API Key (generated in your OCI Profile)
4. Your personal public SSH key (e.g. `~/.ssh/id_ed25519.pub`)

### Step-by-Step Instructions

1. **Navigate to the OCI Terraform directory:**
   ```bash
   cd oci/terraform
   ```

2. **Create your `terraform.tfvars` from the example:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

3. **Fill in your OCI credentials in `terraform.tfvars`:**
   - `tenancy_ocid`: Found under Tenancy details in the console
   - `user_ocid`: Found under your User profile
   - `fingerprint`: Generated when uploading your API key
   - `private_key_path`: Path to your `.pem` key
   - `ssh_public_key`: Your public SSH key string
   - Your application secrets (Stripe, Database URL, Gemini, etc.)

4. **Initialize and Apply:**
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

5. **Update DNS Records:**
   The Terraform output will print `server_public_ip`. Update your DNS A-records in Cloudflare or your registrar:
   - `share2.me` $\rightarrow$ `<server_public_ip>`
   - `api.share2.me` $\rightarrow$ `<server_public_ip>`
   - `share2me.in` $\rightarrow$ `<server_public_ip>`

6. **Verify the Deployment:**
   ```bash
   ssh -i <your-private-key> ubuntu@<server_public_ip>

   # Check cloud-init provisioning logs:
   tail -f /var/log/bootstrap.log

   # Check Caddy status:
   sudo systemctl status caddy

   # Inspect application directory:
   cd /opt/share2me && ls -la
   ```

