output "api_endpoint" {
  value = aws_apigatewayv2_stage.prod.invoke_url
}

output "github_actions_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes via OIDC — set as AWS_ROLE_ARN in GitHub Actions secrets"
  value       = aws_iam_role.github_actions.arn
}

output "function_names" {
  description = "Full names of the portfolio Lambda functions (portfolio-*)"
  value       = [for name in local.functions : "portfolio-${name}"]
}

output "api_id" {
  description = "API Gateway v2 (HTTP) API ID — used as the ApiId CloudWatch dimension"
  value       = aws_apigatewayv2_api.portfolio.id
}

output "api_name" {
  description = "API Gateway v2 (HTTP) API name"
  value       = aws_apigatewayv2_api.portfolio.name
}
