# ─── S3 Bucket for Auto-Generated Blogs ───────────────────────────────────────
resource "aws_s3_bucket" "auto_blogs" {
  bucket = "${var.project_name}-auto-blogs-${var.environment}"
  tags = {
    Name        = "${var.project_name}-auto-blogs-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "auto_blogs_sse" {
  bucket = aws_s3_bucket.auto_blogs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "auto_blogs_pab" {
  bucket = aws_s3_bucket.auto_blogs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── IAM Policy for ECS Backend ───────────────────────────────────────────────
resource "aws_iam_policy" "ecs_read_blogs" {
  name        = "${var.project_name}-ecs-read-blogs-${var.environment}"
  description = "Allows ECS tasks to read auto-generated blogs"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.auto_blogs.arn,
          "${aws_s3_bucket.auto_blogs.arn}/*"
        ]
      }
    ]
  })
}

# Attach to the ECS EC2 Instance Role (since task role is not explicitly defined)
resource "aws_iam_role_policy_attachment" "ecs_read_blogs_attach" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = aws_iam_policy.ecs_read_blogs.arn
}
