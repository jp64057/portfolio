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
