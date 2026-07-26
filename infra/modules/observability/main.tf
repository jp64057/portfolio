# ── SNS — alarm notifications ─────────────────────────────────────────────────

resource "aws_sns_topic" "alarms" {
  name = "portfolio-alarms"
}

# Email subscription requires a one-time confirmation click in the inbox.
resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ── CloudWatch alarms ─────────────────────────────────────────────────────────

# One error alarm per Lambda: fires when a function logs any errors in 5 min.
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.function_names)

  alarm_name          = "${each.value}-errors"
  alarm_description   = "Errors on ${each.value}"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = each.value }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# API Gateway 5xx alarm: fires on server-side API failures.
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "portfolio-api-5xx"
  alarm_description   = "5xx responses from the portfolio HTTP API"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = var.api_id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

# ── CloudWatch dashboard ──────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "portfolio" {
  dashboard_name = "portfolio"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title   = "Lambda invocations"
          region  = var.region
          view    = "timeSeries"
          stacked = false
          metrics = [for fn in var.function_names : ["AWS/Lambda", "Invocations", "FunctionName", fn]]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6,
        properties = {
          title   = "Lambda errors"
          region  = var.region
          view    = "timeSeries"
          metrics = [for fn in var.function_names : ["AWS/Lambda", "Errors", "FunctionName", fn]]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title   = "Lambda duration (avg ms)"
          region  = var.region
          view    = "timeSeries"
          stat    = "Average"
          metrics = [for fn in var.function_names : ["AWS/Lambda", "Duration", "FunctionName", fn]]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title   = "Lambda throttles"
          region  = var.region
          view    = "timeSeries"
          metrics = [for fn in var.function_names : ["AWS/Lambda", "Throttles", "FunctionName", fn]]
        }
      },
      {
        type = "metric", x = 0, y = 12, width = 12, height = 6,
        properties = {
          title  = "API Gateway 4xx / 5xx"
          region = var.region
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "4xx", "ApiId", var.api_id],
            ["AWS/ApiGateway", "5xx", "ApiId", var.api_id],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 12, width = 12, height = 6,
        properties = {
          title  = "API Gateway requests + latency"
          region = var.region
          view   = "timeSeries"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.api_id],
            ["AWS/ApiGateway", "Latency", "ApiId", var.api_id, { stat = "Average", yAxis = "right" }],
          ]
        }
      },
    ]
  })
}

# ── AWS Budgets — cost guardrail ──────────────────────────────────────────────
# Protects the free-tier credits: notifies as actual/forecast spend approaches
# the monthly budget.

resource "aws_budgets_budget" "monthly" {
  name         = "portfolio-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = var.alarm_email == "" ? [] : [50, 80]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alarm_email]
    }
  }

  dynamic "notification" {
    for_each = var.alarm_email == "" ? [] : [100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "FORECASTED"
      subscriber_email_addresses = [var.alarm_email]
    }
  }
}
