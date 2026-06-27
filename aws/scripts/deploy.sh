#!/bin/bash
# ─── Share2Me Deployment Script ───────────────────────────────────────────────
# Builds both Docker images, pushes to ECR, then triggers a rolling ECS deploy.
#
# Usage:
#   bash aws/scripts/deploy.sh                  # Full deploy (build + push + deploy)
#   bash aws/scripts/deploy.sh --build-only     # Build images locally, skip push & ECS
#   bash aws/scripts/deploy.sh --push-only      # Push already-built images (skip build)
#   bash aws/scripts/deploy.sh --deploy-only    # Force new ECS deployment (skip build/push)
#
# Prerequisites:
#   - AWS CLI configured: aws configure
#   - Docker installed and running
#   - Terraform applied at least once (to create the ECR repositories)

set -euo pipefail

# ─── Parse flags ──────────────────────────────────────────────────────────────
BUILD=true
PUSH=true
DEPLOY=true

for arg in "$@"; do
  case "$arg" in
    --build-only)  PUSH=false;  DEPLOY=false ;;
    --push-only)   BUILD=false; DEPLOY=false ;;
    --deploy-only) BUILD=false; PUSH=false   ;;
  esac
done

# ─── Config ───────────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-ap-south-1}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROJECT="share2me"
ECS_CLUSTER="${PROJECT}-cluster"
ECS_SERVICE="${PROJECT}-service"

FRONTEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/frontend"
BACKEND_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/backend"

# Use the short git commit SHA as the image tag for full traceability
IMAGE_TAG="$(git rev-parse --short HEAD)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Share2Me ECS Deployment"
echo "  Account : ${AWS_ACCOUNT_ID}"
echo "  Region  : ${AWS_REGION}"
echo "  Tag     : ${IMAGE_TAG}"
echo "  Build   : ${BUILD} | Push: ${PUSH} | Deploy: ${DEPLOY}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Build Images ──────────────────────────────────────────────────────────
if [ "$BUILD" = true ]; then
  echo "→ Building backend image..."
  docker build \
    --platform linux/amd64 \
    --tag "${BACKEND_REPO}:${IMAGE_TAG}" \
    --tag "${BACKEND_REPO}:latest" \
    --file "${ROOT_DIR}/backend/Dockerfile" \
    "${ROOT_DIR}/backend"

  echo "→ Building frontend image..."
  docker build \
    --platform linux/amd64 \
    --build-arg NEXT_PUBLIC_SIGNAL_URL="https://api.share2.me" \
    --build-arg DOCKER_BUILD="1" \
    --tag "${FRONTEND_REPO}:${IMAGE_TAG}" \
    --tag "${FRONTEND_REPO}:latest" \
    --file "${ROOT_DIR}/frontend/Dockerfile" \
    "${ROOT_DIR}/frontend"
fi

# ─── 2. Authenticate Docker to ECR & Push ────────────────────────────────────
if [ "$PUSH" = true ]; then
  echo "→ Logging in to ECR..."
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  echo "→ Pushing backend to ECR..."
  docker push "${BACKEND_REPO}:${IMAGE_TAG}"
  docker push "${BACKEND_REPO}:latest"

  echo "→ Pushing frontend to ECR..."
  docker push "${FRONTEND_REPO}:${IMAGE_TAG}"
  docker push "${FRONTEND_REPO}:latest"
fi

# ─── 3. Force ECS Rolling Deployment ─────────────────────────────────────────
if [ "$DEPLOY" = true ]; then
  echo "→ Triggering ECS rolling deployment..."
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${ECS_SERVICE}" \
    --force-new-deployment \
    --region "${AWS_REGION}" \
    --query "service.deployments[0].{Status:status,Running:runningCount,Desired:desiredCount}" \
    --output table

  echo "→ Waiting for service to stabilize (~2 min)..."
  aws ecs wait services-stable \
    --cluster "${ECS_CLUSTER}" \
    --services "${ECS_SERVICE}" \
    --region "${AWS_REGION}"

  echo ""
  echo "✅ Deployment complete!"
  echo "   Image   : ${IMAGE_TAG}"
  echo "   Frontend: https://share2.me"
  echo "   Backend : https://api.share2.me/health"
fi
