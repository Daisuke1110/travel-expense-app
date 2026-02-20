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
  description = "Base domain"
}

variable "frontend_subdomain" {
  type        = string
  description = "Frontend subdomain"
}

variable "acm_certificate_arn_us_east_1" {
  type        = string
  description = "ACM cert ARN in us-east-1 for CloudFront"
}

variable "account_id" {
  type        = number
  description = "account id"
}
