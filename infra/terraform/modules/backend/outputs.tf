output "api_endpoint" {
  value = aws_apigatewayv2_api.http_api.api_endpoint
}

output "api_domain_name" {
  value = aws_apigatewayv2_domain_name.api_domain.domain_name_configuration[0].target_domain_name
}

output "api_domain_zone_id" {
  value = aws_apigatewayv2_domain_name.api_domain.domain_name_configuration[0].hosted_zone_id
}
