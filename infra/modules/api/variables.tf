variable "dynamodb_table" {
  type = string
}

variable "ses_from_address" {
  type = string
}

variable "ses_to_address" {
  type = string
}

variable "github_pat" {
  type      = string
  sensitive = true
  default   = ""
}

variable "github_repo" {
  type        = string
  description = "owner/repo — used to scope the GitHub Actions OIDC trust"
}

variable "guestbook_admin_token" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Optional shared secret enabling DELETE /api/guestbook. Empty disables deletion."
}

variable "turnstile_secret_key" {
  type      = string
  sensitive = true
  # Empty by default — no insecure "always passes" test secret. When empty the
  # contact handler fails CLOSED in Lambda. Supply the real key via TF_VAR.
  default     = ""
  description = "Cloudflare Turnstile secret key for verifying contact-form CAPTCHA tokens."
}

variable "anthropic_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Claude API key for the résumé chatbot. Empty disables the bot (graceful fallback)."
}

variable "chat_model" {
  type        = string
  default     = "claude-haiku-4-5"
  description = "Claude model ID for the résumé chatbot (claude-haiku-4-5 for low cost; claude-opus-4-8 for a more capable, pricier bot)."
}
