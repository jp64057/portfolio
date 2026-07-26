variable "function_names" {
  type        = list(string)
  description = "Full Lambda function names to monitor (portfolio-*)."
}

variable "api_id" {
  type        = string
  description = "API Gateway v2 API ID (ApiId CloudWatch dimension)."
}

variable "api_name" {
  type        = string
  description = "API Gateway v2 API name (for dashboard titles)."
}

variable "region" {
  type        = string
  description = "AWS region (for dashboard widget metrics)."
}

variable "alarm_email" {
  type        = string
  default     = ""
  description = "Email address to receive alarm + budget notifications. Empty disables email subscriptions."
}

variable "monthly_budget_usd" {
  type        = number
  default     = 10
  description = "Monthly cost budget in USD; notifies as spend approaches it (protects free-tier credits)."
}
