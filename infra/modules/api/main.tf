data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name

  functions = ["contact", "github-stats", "visitor-counter", "stats", "guestbook", "chat", "now"]

  # Per-function timeout/memory overrides (default is 3s / 128MB). The chat
  # function proxies the Claude API — seconds of latency + the bundled SDK — so
  # it needs a longer timeout (kept < API Gateway's 30s cap) and more memory.
  # `now` makes up to two sequential GitHub API calls (events + commit), which
  # can exceed the 3s default; give it more headroom + memory (faster CPU/net).
  function_overrides = {
    chat = { timeout = 29, memory_size = 256 }
    now  = { timeout = 10, memory_size = 256 }
  }
}

# ── SES ────────────────────────────────────────────────────────────────────────

resource "aws_ses_email_identity" "sender" {
  email = var.ses_from_address
}

# ── IAM — Lambda execution role ────────────────────────────────────────────────

resource "aws_iam_role" "lambda_exec" {
  name = "portfolio-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app" {
  name = "portfolio-lambda-app"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/${var.dynamodb_table}"
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail"]
        Resource = "*"
        Condition = {
          StringEquals = { "ses:FromAddress" = var.ses_from_address }
        }
      },
    ]
  })
}

# ── Lambda functions ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "functions" {
  for_each          = toset(local.functions)
  name              = "/aws/lambda/portfolio-${each.key}"
  retention_in_days = 7
}

resource "aws_lambda_function" "functions" {
  for_each = toset(local.functions)

  function_name = "portfolio-${each.key}"
  role          = aws_iam_role.lambda_exec.arn
  architectures = ["arm64"]
  runtime       = "nodejs22.x"
  handler       = "handler.handler"
  timeout       = try(local.function_overrides[each.key].timeout, 3)
  memory_size   = try(local.function_overrides[each.key].memory_size, 128)
  filename      = "${path.root}/../api/dist/${each.key}/handler.zip"

  # Placeholder — the CI/CD pipeline updates the code on every deploy.
  # The first `terraform apply` will fail if dist/ doesn't exist yet;
  # run `pnpm --filter api build` and zip each function first, or use
  # `source_code_hash` to detect changes.
  source_code_hash = filebase64sha256("${path.root}/../api/dist/${each.key}/handler.zip")

  environment {
    variables = {
      DYNAMODB_TABLE   = var.dynamodb_table
      SES_FROM_ADDRESS = var.ses_from_address
      SES_TO_ADDRESS   = var.ses_to_address
      GITHUB_PAT       = var.github_pat
      ALLOWED_ORIGIN   = "*"
      # Guestbook: flip to "false" to require manual approval before entries show.
      GUESTBOOK_AUTO_APPROVE = "true"
      # Empty = admin delete disabled. Set a token to enable DELETE /api/guestbook.
      GUESTBOOK_ADMIN_TOKEN = var.guestbook_admin_token
      # Cloudflare Turnstile secret for the contact form (defaults to CF's
      # always-pass test secret; set a real one for actual spam protection).
      TURNSTILE_SECRET_KEY = var.turnstile_secret_key
      # Claude API key for the "Ask my résumé" chatbot. Empty ⇒ the chat
      # endpoint returns a graceful "not configured" fallback.
      ANTHROPIC_API_KEY = var.anthropic_api_key
      CHAT_MODEL        = var.chat_model
    }
  }

  # Function code is deployed by the deploy-api workflow (lambda
  # update-function-code), not Terraform. Ignore source_code_hash so plans
  # don't perpetually show phantom in-place updates after each API deploy.
  lifecycle {
    ignore_changes = [source_code_hash]
  }

  depends_on = [aws_cloudwatch_log_group.functions]
}

# ── HTTP API Gateway v2 ────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "portfolio" {
  name          = "portfolio"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
    max_age       = 300
  }
}

# Per-request audit trail for the API (source IP, route, status, latency) — the
# forensic record for the abuse-prone endpoints. Short retention to bound cost.
# (issue #115)
resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/portfolio-access"
  retention_in_days = 14
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.portfolio.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId    = "$context.requestId"
      ip           = "$context.identity.sourceIp"
      requestTime  = "$context.requestTime"
      httpMethod   = "$context.httpMethod"
      routeKey     = "$context.routeKey"
      path         = "$context.path"
      status       = "$context.status"
      responseLen  = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
    })
  }

  # HTTP APIs have no throttling unless set — without this, every route is
  # reachable at the account soft limit (~10k rps). A global backstop protects
  # all routes; the cost-bearing POSTs (chat → Anthropic, contact → SES) get
  # much tighter caps. These are volumetric guardrails on top of the per-IP /
  # monthly-token application limits, not a replacement for them. (issue #101)
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 20
  }

  route_settings {
    route_key              = "POST /api/chat"
    throttling_burst_limit = 3
    throttling_rate_limit  = 2
  }

  route_settings {
    route_key              = "POST /api/contact"
    throttling_burst_limit = 3
    throttling_rate_limit  = 2
  }

  # route_settings reference route keys that must already exist in the stage.
  depends_on = [aws_apigatewayv2_route.routes]
}

resource "aws_apigatewayv2_integration" "functions" {
  for_each = toset(local.functions)

  api_id                 = aws_apigatewayv2_api.portfolio.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.functions[each.key].invoke_arn
  payload_format_version = "2.0"
}

locals {
  # Keyed by route (not function), so one function can back several methods on
  # the same path — the guestbook serves GET/POST/DELETE on /api/guestbook.
  routes = {
    "contact"          = { func = "contact", method = "POST", path = "/api/contact" }
    "github-stats"     = { func = "github-stats", method = "GET", path = "/api/github-stats" }
    "visitor-counter"  = { func = "visitor-counter", method = "POST", path = "/api/visit" }
    "now"              = { func = "now", method = "GET", path = "/api/now" }
    "stats"            = { func = "stats", method = "GET", path = "/api/stats" }
    "guestbook-list"   = { func = "guestbook", method = "GET", path = "/api/guestbook" }
    "guestbook-sign"   = { func = "guestbook", method = "POST", path = "/api/guestbook" }
    "guestbook-delete" = { func = "guestbook", method = "DELETE", path = "/api/guestbook" }
    "chat"             = { func = "chat", method = "POST", path = "/api/chat" }
  }
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.portfolio.id
  route_key = "${each.value.method} ${each.value.path}"
  target    = "integrations/${aws_apigatewayv2_integration.functions[each.value.func].id}"
}

resource "aws_lambda_permission" "apigw" {
  for_each = toset(local.functions)

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.functions[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.portfolio.execution_arn}/*/*"
}

# ── GitHub Actions OIDC ────────────────────────────────────────────────────────

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions" {
  name = "portfolio-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Only the main branch of this exact repo can assume this role
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions" {
  name = "portfolio-github-actions-deploy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = ["arn:aws:s3:::jp64057-portfolio-site", "arn:aws:s3:::jp64057-portfolio-site/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:UpdateFunctionCode"]
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:portfolio-*"
      },
    ]
  })
}
