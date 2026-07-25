module "dns" {
  source = "./modules/dns"

  root_domain = var.root_domain
}

module "data" {
  source = "./modules/data"
}

module "api" {
  source = "./modules/api"

  dynamodb_table   = module.data.table_name
  ses_from_address = var.ses_from_address
  ses_to_address   = var.ses_to_address
  github_pat       = var.github_pat
  github_repo      = var.github_repo
}

module "cdn" {
  source = "./modules/cdn"

  api_gateway_endpoint = module.api.api_endpoint
}
