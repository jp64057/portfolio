output "cloudfront_domain" {
  description = "CloudFront distribution domain name — use this as your site URL"
  value       = module.cdn.cloudfront_domain
}

output "s3_bucket" {
  description = "S3 bucket name for the static site assets"
  value       = module.cdn.s3_bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — used in the deploy workflow for cache invalidation"
  value       = module.cdn.cloudfront_distribution_id
}

output "api_endpoint" {
  description = "API Gateway base URL (set as NEXT_PUBLIC_API_URL in the frontend — leave empty if using CloudFront /api/* routing)"
  value       = module.api.api_endpoint
}
