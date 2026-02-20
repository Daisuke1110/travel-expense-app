output "users_table_name" {
  value = aws_dynamodb_table.users.name
}

output "trips_table_name" {
  value = aws_dynamodb_table.trips.name
}

output "trip_members_table_name" {
  value = aws_dynamodb_table.trip_members.name
}

output "expenses_table_name" {
  value = aws_dynamodb_table.expenses.name
}
