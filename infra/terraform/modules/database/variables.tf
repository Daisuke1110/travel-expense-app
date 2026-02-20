variable "project_name" {
  type        = string
  description = "Project nem prefix"
}

variable "stage" {
  type        = string
  description = "Deployment stage"
}

variable "enable_pitr" {
  type        = bool
  description = "enable DynamoDB PIRT"
  default     = false
}
