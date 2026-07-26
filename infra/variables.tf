variable "aws_region" {
  description = "AWS region for the main provider"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repo in the form owner/repo (used for OIDC trust)"
  type        = string
  default     = "jp64057/portfolio"
}

variable "root_domain" {
  description = "Root domain hosted in Route 53 (registered externally at GoDaddy)"
  type        = string
  default     = "prue.info"
}

variable "site_domain" {
  description = "Fully-qualified domain the portfolio is served on"
  type        = string
  default     = "jacob.prue.info"
}

variable "ses_from_address" {
  description = "Verified SES sender email address"
  type        = string
}

variable "ses_to_address" {
  description = "Email address to receive contact form submissions"
  type        = string
}

variable "github_pat" {
  description = "GitHub Personal Access Token for the github-stats Lambda (read-only, public repos)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "guestbook_admin_token" {
  description = "Optional shared secret enabling DELETE /api/guestbook. Empty disables deletion."
  type        = string
  sensitive   = true
  default     = ""
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile secret key for the contact-form CAPTCHA (defaults to CF's test secret)."
  type        = string
  sensitive   = true
  default     = "1x0000000000000000000000000000000AA"
}

variable "anthropic_api_key" {
  description = "Claude API key for the résumé chatbot. Empty disables the bot (graceful fallback)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "chat_model" {
  description = "Claude model ID for the résumé chatbot (e.g. claude-haiku-4-5 for lower cost)."
  type        = string
  default     = "claude-opus-4-8"
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget in USD for the billing alarm (protects free-tier credits)."
  type        = number
  default     = 10
}
