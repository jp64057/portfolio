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
