#!/bin/bash
# ─── Share2Me Deployment Script ───────────────────────────────────────────────
# Usage: ./aws/scripts/deploy.sh [--push-only | --infra-only]
# This script: 1) builds Docker images, 2) pushes to ECR, 3) triggers ECS deploy.
#
# Prerequisites:
#   - AWS CLI configured: aws configure
#   - Docker installed and running
#   - Terraform applied at least once (to create ECR repositories)

set -euo pipefail

# ─── Config (edit these or export as env vars) ────────────────────────────────
AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROJECT="share2me"
ECS_CLUSTER="${PROJECT}-cluster"
ECS_SERVICE="${PROJECT}-service"

FRONTEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/frontend"
BACKEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/backend"

# Use the short git commit SHA as the image tag for traceability
IMAGE_TAG="$(git rev-parse --short HEAD)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Share2Me ECS Deployment"
echo "  Account: ${AWS_ACCOUNT_ID}"
echo "  Region:  ${AWS_REGION}"
echo "  Tag:     ${IMAGE_TAG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Authenticate Docker to ECR ───────────────────────────────────────────
echo "→ Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ─── 2. Build Images ──────────────────────────────────────────────────────────
echo "→ Building backend image..."
docker build \
  --platform linux/amd64 \
  --tag "${BACKEND_REPO}:${IMAGE_TAG}" \
  --tag "${BACKEND_REPO}:latest" \
  --file "${ROOT_DIR}/backend/Dockerfile" \
  "${ROOT_DIR}/backend"

echo "→ Building frontend image..."
# The NEXT_PUBLIC_SIGNAL_URL is baked in at build time
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SIGNAL_URL="https://api.share2.me" \
  --tag "${FRONTEND_REPO}:${IMAGE_TAG}" \
  --tag "${FRONTEND_REPO}:latest" \
  --file "${ROOT_DIR}/frontend/Dockerfile" \
  "${ROOT_DIR}/frontend"

# ─── 3. Push to ECR ───────────────────────────────────────────────────────────
echo "→ Pushing backend to ECR..."
docker push "${BACKEND_REPO}:${IMAGE_TAG}"
docker push "${BACKEND_REPO}:latest"

echo "→ Pushing frontend to ECR..."
docker push "${FRONTEND_REPO}:${IMAGE_TAG}"
docker push "${FRONTEND_REPO}:latest"

# ─── 4. Force ECS Service Update ──────────────────────────────────────────────
# This triggers a rolling deployment — ECS pulls the new 'latest' image
# and gracefully replaces the running task with zero downtime.
echo "→ Triggering ECS rolling deployment..."
aws ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --force-new-deployment \
  --region "${AWS_REGION}" \
  --output table

echo "→ Waiting for service to stabilize (this may take ~2 minutes)..."
aws ecs wait services-stable \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --region "${AWS_REGION}"

echo ""
echo "✅ Deployment complete! Image: ${IMAGE_TAG}"
echo "   Frontend: https://share2.me"
echo "   Backend:  https://api.share2.me/health"
