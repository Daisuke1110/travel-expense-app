variable "project_name" {
  type        = string
  description = "Project name prefix"
}

variable "stage" {
  type        = string
  description = "Deployment stage"
}

variable "domain_name" {
  type        = string
  description = "Base domain (Route53 hosted zone)"
}

variable "frontend_subdomain" {
  type        = string
  description = "Subdomain for frontend"
}

variable "api_subdomain" {
  type        = string
  description = "Subdomain for API"
}

variable "cloudfront_domain_name" {
  type        = string
  description = "CloudFront distribution domain name"
}

variable "api_domain_name" {
  type        = string
  description = "API custom domain name (API Gateway)"
}

variable "api_domain_zone_id" {
  type        = string
  description = "API Gateway custom domain hosted zone ID"
}
