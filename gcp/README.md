# Share2Me — GCP Infrastructure

Production-grade Google Cloud Platform infrastructure for Share2Me v3.5, managed with Terraform.

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                  Google Cloud Platform                  │
                    │                    (asia-south1)                        │
                    │                                                         │
  share2.me ───────►│  ┌─────────────────────────────────────┐              │
                    │  │   Cloud Run: Frontend (Next.js)      │              │
                    │  │   1 vCPU · 512 MB · 0→5 instances    │              │
                    │  │   Auto TLS · Global LB · Scale to 0  │              │
                    │  └─────────────────────────────────────┘              │
                    │                                                         │
  api.share2.me ───►│  ┌─────────────────────────────────────┐              │
                    │  │   Cloud Run: Backend (Node.js)       │              │
                    │  │   2 vCPU · 2 GB · 1→3 instances      │     VPC     │
                    │  │   WebSocket · Session Affinity        │──────┐      │
                    │  │   Puppeteer · LibreOffice · Tesseract │      │      │
                    │  └─────────────────────────────────────┘      │      │
                    │                                                 │      │
                    │  ┌─────────────────────┐  ┌───────────────┐   │      │
                    │  │   Cloud Storage      │  │  Memorystore  │◄──┘      │
                    │  │   (Blog JSONs)       │  │  Redis 1 GB   │          │
                    │  └─────────────────────┘  └───────────────┘          │
                    │                                                         │
                    │  ┌─────────────────────┐  ┌───────────────┐          │
                    │  │  Artifact Registry   │  │ Secret Manager│          │
                    │  │  (Docker images)     │  │ (API keys)    │          │
                    │  └─────────────────────┘  └───────────────┘          │
                    └─────────────────────────────────────────────────────────┘
                                                         │
                    External (unchanged):                 │
                      • Supabase PostgreSQL ◄─────────────┘
                      • Stripe Payments
                      • Metered TURN Server
```

## Prerequisites

1. **GCP Account** with billing enabled and $200 free credits
2. **Terraform** ≥ 1.5 ([install](https://developer.hashicorp.com/terraform/install))
3. **gcloud CLI** ([install](https://cloud.google.com/sdk/docs/install))
4. **Docker** for building container images

## Quick Start

```bash
# 1. Authenticate with GCP
gcloud auth login
gcloud auth application-default login

# 2. Create a GCP project (or use an existing one)
gcloud projects create share2me-prod --name="Share2Me"
gcloud config set project share2me-prod

# 3. Link billing account
gcloud billing accounts list
gcloud billing projects link share2me-prod --billing-account=XXXXX-XXXXX-XXXXX

# 4. Configure Terraform
cd gcp/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project ID and secrets

# 5. Initialize and apply
terraform init
terraform plan     # Review changes
terraform apply    # Deploy infrastructure

# 6. Build and push initial images
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Frontend
docker build -t asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/frontend:latest \
  --build-arg NEXT_PUBLIC_SIGNAL_URL=https://api.share2.me \
  ./frontend
docker push asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/frontend:latest

# Backend
docker build -t asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/backend:latest \
  ./backend
docker push asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/backend:latest

# 7. Deploy to Cloud Run
gcloud run deploy share2me-frontend \
  --image=asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/frontend:latest \
  --region=asia-south1

gcloud run deploy share2me-backend \
  --image=asia-south1-docker.pkg.dev/share2me-prod/share2me-docker/backend:latest \
  --region=asia-south1

# 8. Setup DNS (see terraform output for CNAME records)
terraform output frontend_domain_records
terraform output backend_domain_records
```

## GitHub Actions Setup

After `terraform apply`, set these GitHub repository secrets:

| Secret | Value | Source |
|--------|-------|--------|
| `GCP_PROJECT_ID` | Your GCP project ID | `gcloud config get-value project` |
| `GCP_WIF_PROVIDER` | Workload Identity Provider | `terraform output workload_identity_provider` |
| `GCP_SA_EMAIL` | CI/CD service account | `terraform output github_actions_service_account` |

## File Structure

```
gcp/terraform/
├── main.tf                     # Provider config + API enablement
├── versions.tf                 # Terraform & provider version constraints
├── variables.tf                # All input variables
├── terraform.tfvars            # Your values (git-ignored)
├── terraform.tfvars.example    # Template for new contributors
├── networking.tf               # VPC, subnet, VPC connector, firewall, NAT
├── iam.tf                      # Service accounts, WIF for GitHub Actions
├── artifact_registry.tf        # Docker image repository
├── cloud_run_frontend.tf       # Frontend Cloud Run service
├── cloud_run_backend.tf        # Backend Cloud Run service
├── cloud_storage.tf            # Blog storage bucket
├── redis.tf                    # Memorystore Redis
├── secret_manager.tf           # Application secrets
├── monitoring.tf               # Uptime checks, alerts, error rate policies
├── outputs.tf                  # URLs, DNS records, deploy commands
└── .gitignore                  # Prevent state/secrets from git
```

## Cost Estimate (~$60/month)

| Service | Monthly Cost |
|---------|-------------|
| Cloud Run Frontend (scale-to-zero) | ~$5-8 |
| Cloud Run Backend (1 min instance) | ~$15-25 |
| Memorystore Redis 1GB | ~$35 |
| Artifact Registry | ~$0.10 |
| Cloud Storage | ~$0.01 |
| Secret Manager | Free tier |
| VPC Connector | ~$6 |
| **Total** | **~$60-70** |

> **💡 Budget tip:** Set `redis_enabled = false` to skip Memorystore ($35/mo saved).
> Backend falls back to in-memory Socket.io adapter (works fine with 1 instance).

## Comparison: AWS Free Tier vs GCP

| | AWS (Current) | GCP (New) |
|--|--|--|
| **RAM** | 1 GB shared across 4 containers | 2 GB per service |
| **CPU** | 2 vCPU burstable (throttled) | 2 vCPU dedicated |
| **TLS** | Manual Caddy + Let's Encrypt | Auto-managed |
| **Load Balancer** | None | Built-in global LB |
| **Auto-scaling** | Fixed 1 instance | 0→N automatic |
| **Deployment** | SSH + ECR + ECS | `gcloud run deploy` |
| **Monitoring** | CloudWatch (basic) | Full observability suite |
