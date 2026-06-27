# ─── SSM Parameter Store ──────────────────────────────────────────────────────
# Standard parameters are free. SecureString parameters cost $0.05/month each.
# Secrets are injected into containers at runtime — never baked into Docker images.

resource "aws_ssm_parameter" "metered_api_key" {
  name        = "/share2me/prod/METERED_API_KEY"
  description = "Metered TURN server API key for ICE credential generation"
  type        = "SecureString"
  value       = var.metered_api_key != "" ? var.metered_api_key : "PLACEHOLDER_SET_IN_CONSOLE"

  lifecycle {
    # Ignore changes so you can update the value directly in the console
    # without Terraform overwriting it on next apply
    ignore_changes = [value]
  }

  tags = { Name = "${var.project_name}-metered-api-key" }
}

# Grant the ECS task execution role permission to read these SSM parameters
resource "aws_iam_role_policy" "ecs_task_ssm" {
  name = "${var.project_name}-ecs-ssm-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/share2me/prod/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = ["*"] # Scope to your KMS key ARN if you use a custom CMK
      }
    ]
  })
}
