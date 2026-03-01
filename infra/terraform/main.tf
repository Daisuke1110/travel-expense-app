module "database" {
  source       = "./modules/database"
  project_name = var.project_name
  stage        = var.stage
  enable_pitr  = var.enable_pitr
}

module "backend" {
  source              = "./modules/backend"
  project_name        = var.project_name
  stage               = var.stage
  aws_region          = var.aws_region
  lambda_package_path = var.lambda_package_path
  lambda_handler      = var.lambda_handler
  domain_name         = var.domain_name
  api_subdomain       = var.api_subdomain
  acm_certificate_arn = var.acm_certificate_arn

  trips_table        = module.database.trips_table_name
  trip_members_table = module.database.trip_members_table_name
  users_table        = module.database.users_table_name
  expenses_table     = module.database.expenses_table_name

  cors_allowed_origins = var.cors_allowed_origins

  enable_jwt_authorizer = var.enable_jwt_authorizer
  jwt_issuer            = module.cognito.issuer
  jwt_audience          = [module.cognito.user_pool_client_id]
}

module "frontend" {
  source       = "./modules/frontend"
  project_name = var.project_name
  stage        = var.stage
  account_id   = var.account_id

  domain_name                   = var.domain_name
  frontend_subdomain            = var.frontend_subdomain
  acm_certificate_arn_us_east_1 = var.acm_certificate_arn_us_east_1

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

module "dns" {
  source       = "./modules/dns"
  project_name = var.project_name
  stage        = var.stage
  providers = {
    aws = aws.dns_old
  }

  domain_name        = var.domain_name
  frontend_subdomain = var.frontend_subdomain
  api_subdomain      = var.api_subdomain

  cloudfront_domain_name = module.frontend.cloudfront_domain_name
  api_domain_name        = module.backend.api_domain_name
  api_domain_zone_id     = module.backend.api_domain_zone_id
}

module "cognito" {
  source = "./modules/cognito"

  project_name  = var.project_name
  stage         = var.stage
  domain_prefix = var.cognito_domain_prefix
  callback_urls = var.cognito_callback_urls
  logout_urls   = var.cognito_logout_urls
}
