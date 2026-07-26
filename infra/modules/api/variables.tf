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
  # Cloudflare's public "always passes" test secret — replace with a real key.
  default     = "1x0000000000000000000000000000000AA"
  description = "Cloudflare Turnstile secret key for verifying contact-form CAPTCHA tokens."
}
