terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}
locals {
  users_table        = "${var.project_name}-users-${var.stage}"
  trips_table        = "${var.project_name}-trips-${var.stage}"
  trip_members_table = "${var.project_name}-trip-members-${var.stage}"
  expenses_table     = "${var.project_name}-expenses-${var.stage}"
  tags = {
    Project = var.project_name
    Stage   = var.stage
  }
}

resource "aws_dynamodb_table" "users" {
  name         = local.users_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

   attribute {
    name = "email"
    type = "S"
  }

    global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "trips" {
  name         = local.trips_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "trip_id"

  attribute {
    name = "trip_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "trip_members" {
  name         = local.trip_members_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "trip_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "trip_id"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "trip_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "expenses" {
  name         = local.expenses_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "trip_id"
  range_key    = "datetime_expense_id"

  attribute {
    name = "trip_id"
    type = "S"
  }

  attribute {
    name = "datetime_expense_id"
    type = "S"
  }

  attribute {
    name = "expense_id"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "expense_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  tags = local.tags
}

