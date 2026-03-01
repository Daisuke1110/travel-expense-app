variable "project_name" {
  type        = string
  description = "Project name prefix"
}

variable "stage" {
  type        = string
  description = "Deployment stage (dev/prod)"
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region"
  default     = "ap-northeast-3"
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

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN in API region for API Gateway"
}

variable "acm_certificate_arn_us_east_1" {
  type        = string
  description = "ACM cert ARN in us-east-1 for CloudFront"
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "CORS allowed origins for API Gateway"
}

variable "account_id" {
  type        = number
  description = "account id"
}

variable "enable_pitr" {
  type        = bool
  description = "Enable Dynamodb PITR"
  default     = false
}

variable "lambda_package_path" {
  type        = string
  description = "Path to lambda zip package"
}

variable "lambda_handler" {
  type        = string
  description = "Lambda handler (e.g. app.lambda.handler)"
}

variable "enable_jwt_authorizer" {
  type    = bool
  default = false
}

variable "cognito_domain_prefix" {
  type = string
}

variable "cognito_callback_urls" {
  type = list(string)
}

variable "cognito_logout_urls" {
  type = list(string)
}
