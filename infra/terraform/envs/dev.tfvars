project_name                  = "travel-expense"
stage                         = "dev"
aws_region                    = "ap-northeast-3"
domain_name                   = "daisuke-selfstudy.com"
frontend_subdomain            = "travel-expense-dev"
api_subdomain                 = "travel-expense-api-dev"
acm_certificate_arn           = "arn:aws:acm:ap-northeast-3:804878519476:certificate/2a11c9e6-24ff-40b2-8429-ded416072bc9"
acm_certificate_arn_us_east_1 = "arn:aws:acm:us-east-1:804878519476:certificate/659e1868-c928-4f0e-b51a-6ea992521598"
account_id                    = 804878519476
cors_allowed_origins = [
  "https://travel-expense-dev.daisuke-selfstudy.com",
  "http://localhost:5173"
]
enable_pitr           = false
lambda_package_path   = "C:/travel-expense-app/backend/lambda.zip"
lambda_handler        = "app.lambda.handler"
enable_jwt_authorizer = false
cognito_domain_prefix = "travel-expense-dev-auth"
cognito_callback_urls = ["http://localhost:5173", "https://travel-expense-dev.daisuke-selfstudy.com"]
cognito_logout_urls   = ["http://localhost:5173", "https://travel-expense-dev.daisuke-selfstudy.com"]
