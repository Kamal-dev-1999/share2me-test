# ─── Application Load Balancer ────────────────────────────────────────────────
# ALB is Free Tier eligible for 750 hours/month on a new account.
# It routes traffic to the correct container based on the Host header.

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Enable access logs only if debugging — S3 bucket required and has cost
  # access_logs { bucket = "..." enabled = true }

  tags = { Name = "${var.project_name}-alb" }
}

# ─── Target Groups ────────────────────────────────────────────────────────────
resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-fe-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/"
    protocol            = "HTTP"
    port                = "3000"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200-399"
  }

  # Sticky sessions are important for WebSocket connections on the backend.
  # Not needed for the stateless Next.js frontend.

  tags = { Name = "${var.project_name}-frontend-tg" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-be-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    port                = "8000"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  # Sticky sessions: CRITICAL for Socket.io!
  # When ECS scales to 2 tasks (and thus 2 backend containers), a user MUST
  # always be routed to the same backend container to maintain their WebSocket.
  # Without stickiness, connections would be randomly distributed and break.
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 1 day
    enabled         = true
  }

  tags = { Name = "${var.project_name}-backend-tg" }
}

# ─── HTTP Listener (Port 80) ──────────────────────────────────────────────────
# Redirects all HTTP traffic to HTTPS for security

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─── HTTPS Listener (Port 443) ────────────────────────────────────────────────
# Routes requests to the correct target group based on the Host header.
# Requires an ACM certificate — see acm.tf.

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # Modern TLS only
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  # Default: route to frontend
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Route api.share2.me → backend target group
resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = [var.backend_domain]
    }
  }
}
