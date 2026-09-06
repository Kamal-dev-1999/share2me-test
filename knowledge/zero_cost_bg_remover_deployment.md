# Zero-Cost AI Background Remover Model Deployment Guide

This guide outlines step-by-step procedures to deploy and operate the AI Background Removal model (`rembg` / IS-Net / U2-Net) for **Share2Me** with **$0 hosting cost**.

---

## Architecture Overview & Zero-Cost Options

| Deployment Method | Hosting Location | Compute / Memory | Monthly Cost | Cold Start / Performance |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1: GCP Cloud Run Microservice** *(Recommended)* | Google Cloud Run (`asia-south1`) | 2 vCPU, 2GB RAM | **$0.00** *(Under GCP Free Tier: 2M free requests/mo, scales to 0)* | ~2–3s cold start, ~0.8s execution |
| **Option 2: Client-Side WebAssembly (WASM)** | User's Browser (Client Device) | Local WebGPU / CPU | **$0.00 Forever** *(Zero server dependencies)* | Instant, zero server egress |
| **Option 3: Hugging Face Spaces / Modal Serverless** | HuggingFace or Modal free tier | Serverless Container | **$0.00** *(Community free tier)* | ~5s cold start |

---

## Method 1: Deploy on GCP Cloud Run with $0 Idle Cost (Recommended)

Because Share2Me already uses GCP Cloud Run with GitHub Actions (`.github/workflows/deploy-gcp.yml`), this method integrates directly into your existing infrastructure.

### Why It Is $0
- **GCP Cloud Run Free Tier**: Includes **2 million requests**, **360,000 vCPU-seconds**, and **180,000 GiB-seconds** free each month.
- **Scale to 0 (`--min-instances=0`)**: When no one is using the BG remover tool, instance count scales to zero. It consumes **0 CPU, 0 RAM, and incurs $0.00 cost**.
- **Pre-baked Models**: Models are downloaded and cached during the Docker build stage so the container never performs slow runtime downloads.

---

### Step 1: Create `backend/ml/Dockerfile`

Create `backend/ml/Dockerfile` with the following configuration:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (libgomp for ONNX Runtime, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Pre-download and cache models during Docker build (baked into image)
COPY download_model.py setup_u2net_dir.py ./
RUN python download_model.py && python setup_u2net_dir.py

COPY bg_remover_service.py ./

ENV PORT=8080
ENV HOST=0.0.0.0
ENV U2NET_HOME=/root/.u2net
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://127.0.0.1:8080/health || exit 1

# Run with Gunicorn (1 worker with multiple threads for low-memory concurrency)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "4", "--timeout", "120", "bg_remover_service:app"]
```

---

### Step 2: One-Command Manual CLI Deployment

If you want to deploy immediately using `gcloud`:

```bash
# 1. Authenticate with GCP
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Build and submit image to Google Artifact Registry
gcloud builds submit backend/ml \
  --tag asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/share2me-docker/ml-service:latest

# 3. Deploy to Cloud Run with scale-to-zero ($0 when idle)
gcloud run deploy share2me-ml \
  --image asia-south1-docker.pkg.dev/YOUR_GCP_PROJECT_ID/share2me-docker/ml-service:latest \
  --region asia-south1 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 10 \
  --timeout 120s \
  --allow-unauthenticated
```

> **Key Flag**: `--min-instances 0` ensures zero cost when idle.

---

### Step 3: Add Automated CI/CD to `.github/workflows/deploy-gcp.yml`

In `.github/workflows/deploy-gcp.yml`:

1. Update the path filter in `changes`:
```yaml
          filters: |
            frontend:
              - 'frontend/**'
            backend:
              - 'backend/**'
              - '!backend/ml/**'
            ml:
              - 'backend/ml/**'
```

2. Add the `deploy-ml` job:
```yaml
  # ── Build & Deploy ML Service ───────────────────────────────────────────────
  deploy-ml:
    name: Deploy ML Service
    runs-on: ubuntu-latest
    needs: changes
    if: >
      needs.changes.outputs.ml == 'true' ||
      github.event.inputs.deploy_target == 'both'

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev --quiet

      - name: Build & Push ML Image
        run: |
          IMAGE="${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.AR_REPO }}/ml-service"
          docker build -t ${IMAGE}:${{ github.sha }} -t ${IMAGE}:latest ./backend/ml
          docker push ${IMAGE}:latest

      - name: Deploy to Cloud Run
        run: |
          IMAGE="${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.AR_REPO }}/ml-service:latest"
          gcloud run deploy share2me-ml \
            --image=${IMAGE} \
            --region=${{ env.GCP_REGION }} \
            --memory=2Gi \
            --cpu=2 \
            --min-instances=0 \
            --max-instances=3 \
            --allow-unauthenticated \
            --quiet
```

---

### Step 4: Link Frontend to the Deployed Service

Once deployed, Cloud Run outputs your service URL (e.g. `https://share2me-ml-xyz-el.a.run.app`).

Update the Frontend Cloud Run service:

```bash
gcloud run services update share2me-frontend \
  --region asia-south1 \
  --set-env-vars ML_SERVICE_URL=https://share2me-ml-xyz-el.a.run.app/remove-background
```

Or configure it in **GCP Console**:
1. Go to **Cloud Run** → **share2me-frontend**.
2. Click **Edit & Deploy New Revision**.
3. Under **Variables & Secrets**, add:
   - Name: `ML_SERVICE_URL`
   - Value: `https://share2me-ml-xyz-el.a.run.app/remove-background`
4. Click **Deploy**.

Now `https://www.share2me.in/tools/bg-remover` automatically sends images directly to your Cloud Run ML microservice!

---

## Method 2: 100% In-Browser Client-Side WebAssembly ($0 Forever)

If you don't want to run any Python containers on the cloud, you can run the background removal model **directly inside the client's web browser**.

### How It Works
- Uses `@imgly/background-removal` or `@xenova/transformers` with ONNX WebAssembly.
- The browser downloads a lightweight quantized ONNX model (e.g., RMBG-1.4, ~35MB) once and caches it in IndexedDB.
- Uses WebGPU/WASM multi-threading to process the image client-side in under 1 second.
- **Server cost**: **$0.00 forever** (0 server requests, 0 CPU usage).

### Quick Setup

1. Install client library in `frontend`:
```bash
cd frontend && npm install @imgly/background-removal
```

2. In `frontend/src/components/tools/BgRemoverUI.tsx`:
```typescript
import { removeBackground } from "@imgly/background-removal";

// In handleProcess:
const processClientSide = async (imageFile: File) => {
  setProcessing(true);
  try {
    const blob = await removeBackground(imageFile, {
      progress: (key, current, total) => {
        console.log(`Downloading model / Processing: ${key} ${current}/${total}`);
      }
    });
    const url = URL.createObjectURL(blob);
    setProcessedUrl(url);
  } catch (err) {
    setError("Client-side removal failed: " + err);
  } finally {
    setProcessing(false);
  }
};
```

---

## Maintenance & Monitoring Tips

1. **Verify Health Endpoint**:
   ```bash
   curl -s https://<YOUR-ML-SERVICE-URL>/health
   # Returns: {"status": "ready", "loaded_models": ["isnet-general-use", "u2net"]}
   ```
2. **Cost Alarms**: Set a GCP Budget Alert at `$1.00` in GCP Billing to ensure you are notified if usage ever exceeds the free tier limits.
3. **Memory Sizing**: Keep `--memory=2Gi`. Anything less than 1.5Gi might result in an Out-Of-Memory (OOM) error during simultaneous high-resolution image decodes.
