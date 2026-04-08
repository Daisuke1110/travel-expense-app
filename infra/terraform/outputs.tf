output "api_endpoint" {
  value = module.backend.api_endpoint
}

output "api_domain_target" {
  value = module.backend.api_domain_name
}

output "api_domain_zone_id" {
  value = module.backend.api_domain_zone_id
}

output "frontend_bucket_name" {
  value = module.frontend.s3_bucket_name
}

output "cloudfront_domain_name" {
  value = module.frontend.cloudfront_domain_name
}

output "frontend_url" {
  value = "https://${var.frontend_subdomain}.${var.domain_name}"
}

output "api_url" {
  value = "https://${var.api_subdomain}.${var.domain_name}"
}

output "cognito_domain" {
  value = module.cognito.domain
}

output "cognito_client_id" {
  value = module.cognito.user_pool_client_id
}
