import os
from functools import lru_cache

import boto3


@lru_cache()
def get_dynamodb_resource():
    """
    Create a DynamoDB resource configured from environment variables.

    - DYNAMODB_ENDPOINT: optional endpoint_url (use for DynamoDB Local)
    - AWS_REGION: region name (defaults to ap-northeast-1)
    """
    endpoint = os.environ.get("DYNAMODB_ENDPOINT")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")

    kwargs: dict = {"region_name": region}
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    return boto3.resource("dynamodb", **kwargs)


@lru_cache()
def get_table_names():
    """
    Central place to read table names from env so they can be switched
    between local/prod without touching code.
    """
    return {
        "trips": os.environ.get("TRIPS_TABLE", "Trips"),
        "trip_members": os.environ.get("TRIP_MEMBERS_TABLE", "TripMembers"),
        "users": os.environ.get("USERS_TABLE", "Users"),
        "expenses": os.environ.get("EXPENSES_TABLE", "Expenses"),
    }
