"""
Create DynamoDB Local tables and seed minimal data for local development.

Usage:
    python backend/scripts/seed_local.py
Environment:
    DYNAMODB_ENDPOINT (default: http://localhost:8001)
    AWS_REGION (default: ap-northeast-1)
    TRIPS_TABLE, TRIP_MEMBERS_TABLE, EXPENSES_TABLE, USERS_TABLE (optional overrides)
"""

import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError


os.environ.setdefault("AWS_ACCESS_KEY_ID", "local")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "local")
os.environ.setdefault("AWS_REGION", "ap-northeast-1")


def get_resource():
    endpoint = os.environ.get("DYNAMODB_ENDPOINT", "http://localhost:8001")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    return boto3.resource("dynamodb", endpoint_url=endpoint, region_name=region)


def table_names():
    return {
        "trips": os.environ.get("TRIPS_TABLE", "Trips"),
        "trip_members": os.environ.get("TRIP_MEMBERS_TABLE", "TripMembers"),
        "expenses": os.environ.get("EXPENSES_TABLE", "Expenses"),
        "users": os.environ.get("USERS_TABLE", "Users"),
    }


def ensure_tables(dynamodb):
    names = table_names()
    specs = {
        names["users"]: {
            "KeySchema": [{"AttributeName": "user_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [
                {"AttributeName": "user_id", "AttributeType": "S"}
            ],
        },
        names["trips"]: {
            "KeySchema": [{"AttributeName": "trip_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [
                {"AttributeName": "trip_id", "AttributeType": "S"}
            ],
        },
        names["trip_members"]: {
            "KeySchema": [
                {"AttributeName": "user_id", "KeyType": "HASH"},
                {"AttributeName": "trip_id", "KeyType": "RANGE"},
            ],
            "AttributeDefinitions": [
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "trip_id", "AttributeType": "S"},
            ],
            "GlobalSecondaryIndexes": [
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "trip_id", "KeyType": "HASH"},
                        {"AttributeName": "user_id", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        },
        names["expenses"]: {
            "KeySchema": [
                {"AttributeName": "trip_id", "KeyType": "HASH"},
                {"AttributeName": "datetime_expense_id", "KeyType": "RANGE"},
            ],
            "AttributeDefinitions": [
                {"AttributeName": "trip_id", "AttributeType": "S"},
                {"AttributeName": "datetime_expense_id", "AttributeType": "S"},
                {"AttributeName": "expense_id", "AttributeType": "S"},
            ],
            "GlobalSecondaryIndexes": [
                {
                    "IndexName": "GSI1",
                    "KeySchema": [{"AttributeName": "expense_id", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        },
    }

    for name, spec in specs.items():
        try:
            dynamodb.Table(name).load()
            print(f"[skip] table exists: {name}")
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ResourceNotFoundException":
                raise
            print(f"[create] table: {name}")
            dynamodb.create_table(
                TableName=name,
                BillingMode="PAY_PER_REQUEST",
                **spec,
            )

    # wait for tables to be active
    for name in specs:
        table = dynamodb.Table(name)
        while True:
            table.reload()
            if table.table_status == "ACTIVE":
                break
            print(f"[wait] {name} status={table.table_status}")
            time.sleep(1)


def seed_data(dynamodb):
    names = table_names()
    now = datetime.now(timezone.utc).isoformat()

    users = [
        {
            "user_id": "user-123",
            "name": "松田",
            "email": "you@example.com",
            "created_at": now,
        },
        {
            "user_id": "user-456",
            "name": "柳生",
            "email": "friend@example.com",
            "created_at": now,
        },
        {
            "user_id": "user-999",
            "name": "井上",
            "email": "friend@example.com",
            "created_at": now,
        },
    ]
    trips = [
        {
            "trip_id": "trip-123",
            "owner_id": "user-123",
            "title": "2026 バンコク",
            "country": "TH",
            "start_date": "2026-05-01",
            "end_date": "2026-05-05",
            "base_currency": "THB",
            "rate_to_jpy": Decimal("4.2"),
            "created_at": now,
        },
        {
            "trip_id": "trip-999",
            "owner_id": "user-456",
            "title": "2026 ソウル旅",
            "country": "KR",
            "start_date": "2026-06-10",
            "end_date": "2026-06-13",
            "base_currency": "KRW",
            "rate_to_jpy": Decimal("0.11"),
            "created_at": now,
        },
    ]
    trip_members = [
        {
            "user_id": "user-123",
            "trip_id": "trip-123",
            "role": "owner",
            "joined_at": now,
        },
        {
            "user_id": "user-456",
            "trip_id": "trip-123",
            "role": "member",
            "joined_at": now,
        },
        {
            "user_id": "user-456",
            "trip_id": "trip-999",
            "role": "owner",
            "joined_at": now,
        },
        {
            "user_id": "user-123",
            "trip_id": "trip-999",
            "role": "member",
            "joined_at": now,
        },
        {
            "user_id": "user-999",
            "trip_id": "trip-999",
            "role": "member",
            "joined_at": now,
        },
    ]
    expenses = [
        {
            "trip_id": "trip-123",
            "expense_id": "expense-001",
            "datetime": "2026-05-01T09:00:00Z",
            "datetime_expense_id": "2026-05-01T09:00:00Z#expense-001",
            "user_id": "user-123",
            "amount": 1200,
            "currency": "THB",
            "category": "food",
            "note": "朝食",
            "created_at": now,
        }
    ]

    def put_items(table_name: str, items: list, overwrite_keys: list):
        table = dynamodb.Table(table_name)
        with table.batch_writer(overwrite_by_pkeys=overwrite_keys) as batch:
            for item in items:
                batch.put_item(Item=item)

    put_items(names["users"], users, ["user_id"])
    put_items(names["trips"], trips, ["trip_id"])
    put_items(names["trip_members"], trip_members, ["user_id", "trip_id"])
    put_items(names["expenses"], expenses, ["trip_id", "datetime_expense_id"])
    print("[done] seeded sample data")


if __name__ == "__main__":
    dynamodb = get_resource()
    ensure_tables(dynamodb)
    seed_data(dynamodb)
