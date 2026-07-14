$ErrorActionPreference = 'Stop'

$AWS_REGION = "ap-south-1"
$AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text).Trim()
$PROJECT = "share2me"
$ECS_CLUSTER = "${PROJECT}-cluster"
$ECS_SERVICE = "${PROJECT}-service"
$FRONTEND_REPO = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/frontend"
$BACKEND_REPO = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT}/backend"
$IMAGE_TAG = (git rev-parse --short HEAD).Trim()

Write-Host "========================================"
Write-Host " Deploying Share2Me to ECS via PowerShell"
Write-Host " Account : $AWS_ACCOUNT_ID"
Write-Host " Tag     : $IMAGE_TAG"
Write-Host "========================================"

Write-Host "-> Building backend image..."
docker build --platform linux/amd64 --tag "${BACKEND_REPO}:${IMAGE_TAG}" --tag "${BACKEND_REPO}:latest" --file "backend/Dockerfile" "backend"

Write-Host "-> Building frontend image..."
docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_SIGNAL_URL="https://api.share2.me" --build-arg DOCKER_BUILD="1" --tag "${FRONTEND_REPO}:${IMAGE_TAG}" --tag "${FRONTEND_REPO}:latest" --file "frontend/Dockerfile" "frontend"

Write-Host "-> Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

Write-Host "-> Pushing backend image..."
docker push "${BACKEND_REPO}:${IMAGE_TAG}"
docker push "${BACKEND_REPO}:latest"

Write-Host "-> Pushing frontend image..."
docker push "${FRONTEND_REPO}:${IMAGE_TAG}"
docker push "${FRONTEND_REPO}:latest"

Write-Host "-> Triggering ECS Rolling Deployment..."
aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment --region $AWS_REGION --query "service.deployments[0].{Status:status,Running:runningCount,Desired:desiredCount}" --output table

Write-Host "-> Deployment triggered! You can check the AWS console for stabilization."
