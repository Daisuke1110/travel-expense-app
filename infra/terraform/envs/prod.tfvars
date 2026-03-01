project_name                  = "travel-expense"
stage                         = "prod"
aws_region                    = "ap-northeast-3"
domain_name                   = "daisuke-selfstudy.com"
frontend_subdomain            = "travel-expense"
api_subdomain                 = "travel-expense-api"
acm_certificate_arn           = "arn:aws:acm:ap-northeast-3:804878519476:certificate/2a11c9e6-24ff-40b2-8429-ded416072bc9"
acm_certificate_arn_us_east_1 = "arn:aws:acm:us-east-1:804878519476:certificate/659e1868-c928-4f0e-b51a-6ea992521598"
account_id                    = 804878519476
cors_allowed_origins = [
  "https://travel-expense.daisuke-selfstudy.com"
]
enable_pitr           = true
lambda_package_path   = "C:/travel-expense-app/backend/lambda.zip"
lambda_handler        = "app.lambda.handler"
enable_jwt_authorizer = true
cognito_domain_prefix = "travel-expense-prod-auth"
cognito_callback_urls = ["https://travel-expense.daisuke-selfstudy.com"]
cognito_logout_urls   = ["https://travel-expense.daisuke-selfstudy.com"]
