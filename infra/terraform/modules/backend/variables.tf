variable "project_name" {
  type        = string
  description = "Project name prefix"
}

variable "stage" {
  type        = string
  description = "Deployment stage"
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region"
}

variable "trips_table" {
  type = string
}

variable "trip_members_table" {
  type = string
}

variable "users_table" {
  type = string
}

variable "expenses_table" {
  type = string
}

variable "cors_allowed_origins" {
  type = list(string)
}

variable "lambda_package_path" {
  type        = string
  description = "Path to lambda zip package"
}

variable "lambda_handler" {
  type        = string
  description = "Lambda handler (e.g. app.lambda.handler)"
}

variable "lambda_runtime" {
  type    = string
  default = "python3.13"
}

variable "lambda_timeout" {
  type    = number
  default = 30
}

variable "lambda_memory" {
  type    = number
  default = 512
}

variable "domain_name" {
  type        = string
  description = "Base domain (Route53 hosted zone)"
}

variable "api_subdomain" {
  type = string
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN in API region for API Gateway"
}
