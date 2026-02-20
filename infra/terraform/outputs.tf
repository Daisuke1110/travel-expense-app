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
