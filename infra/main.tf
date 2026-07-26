module "dns" {
  source = "./modules/dns"

  root_domain = var.root_domain
}

module "data" {
  source = "./modules/data"
}

module "api" {
  source = "./modules/api"

  dynamodb_table        = module.data.table_name
  ses_from_address      = var.ses_from_address
  ses_to_address        = var.ses_to_address
  github_pat            = var.github_pat
  github_repo           = var.github_repo
  guestbook_admin_token = var.guestbook_admin_token
  turnstile_secret_key  = var.turnstile_secret_key
  anthropic_api_key     = var.anthropic_api_key
  chat_model            = var.chat_model
}

module "cdn" {
  source = "./modules/cdn"

  api_gateway_endpoint = module.api.api_endpoint
  site_domain          = var.site_domain
  acm_certificate_arn  = aws_acm_certificate_validation.site.certificate_arn
}

module "observability" {
  source = "./modules/observability"

  function_names     = module.api.function_names
  api_id             = module.api.api_id
  api_name           = module.api.api_name
  region             = var.aws_region
  alarm_email        = var.ses_to_address
  monthly_budget_usd = var.monthly_budget_usd
}
