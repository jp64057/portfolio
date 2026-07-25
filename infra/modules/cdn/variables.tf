variable "api_gateway_endpoint" {
  description = "API Gateway invoke URL (used as the /api/* origin in CloudFront)"
  type        = string
}

variable "site_domain" {
  description = "Custom domain (CNAME/alias) for the distribution; empty = default *.cloudfront.net only"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (must be us-east-1) for the custom domain; empty = use the default CloudFront cert"
  type        = string
  default     = ""
}
