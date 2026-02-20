terraform {
  required_version = ">=1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-3"
}

provider "aws" {
  alias  = "dns_old"
  region = "ap-northeast-3"

  assume_role {
    role_arn = "arn:aws:iam::554739428451:role/Route53AccessRole"
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

