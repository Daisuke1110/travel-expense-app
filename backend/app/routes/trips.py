from typing import Dict, List

from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.db import get_dynamodb_resource, get_table_names

router = APIRouter()


class TripSummary(BaseModel):
    trip_id: str = Field(..., example="trip-123")
    title: str = Field(..., example="2026 バンコク")
    country: str = Field(..., example="TH")
    start_date: str = Field(..., example="2026-05-01")
    end_date: str = Field(..., example="2026-05-05")
    owner_name: str | None = Field(None, example="あなた")


class TripsResponse(BaseModel):
    own_trips: List[TripSummary]
    shared_trips: List[TripSummary]


def _get_user_id(x_debug_user_id: str | None) -> str:
    if not x_debug_user_id:
        raise HTTPException(
            status_code=401, detail="X-Debug-User-Id header is required in MVP mode"
        )
    return x_debug_user_id


@router.get("/me/trips", response_model=TripsResponse)
def list_my_trips(x_debug_user_id: str | None = Header(default=None)):
    """
    Returns trips for the given user by querying TripMembers and joining Trips/Users.
    """
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        trip_member_items = _query_trip_members(
            dynamodb=dynamodb, table_name=tables["trip_members"], user_id=user_id
        )
        if not trip_member_items:
            return TripsResponse(own_trips=[], shared_trips=[])

        trip_ids = [
            item.get("trip_id") for item in trip_member_items if item.get("trip_id")
        ]
        trips = (
            _batch_get_items(
                dynamodb=dynamodb,
                table_name=tables["trips"],
                ids=trip_ids,
                key_name="trip_id",
            )
            if trip_ids
            else []
        )
        trips_by_id: Dict[str, dict] = {
            trip["trip_id"]: trip for trip in trips if "trip_id" in trip
        }

        owner_ids = list(
            {trip.get("owner_id") for trip in trips if trip.get("owner_id")}
        )
        owners = (
            _batch_get_items(
                dynamodb=dynamodb,
                table_name=tables["users"],
                ids=owner_ids,
                key_name="user_id",
            )
            if owner_ids
            else []
        )
        owner_name_map = {
            owner["user_id"]: owner.get("name", "owner")
            for owner in owners
            if "user_id" in owner
        }

        own_trips: List[TripSummary] = []
        shared_trips: List[TripSummary] = []

        for member in trip_member_items:
            trip_id = member.get("trip_id")
            if not trip_id or trip_id not in trips_by_id:
                continue

            trip = trips_by_id[trip_id]
            owner_id = trip.get("owner_id")
            owner_name = owner_name_map.get(owner_id, "owner")

            summary = TripSummary(
                trip_id=trip_id,
                title=trip.get("title", ""),
                country=trip.get("country", ""),
                start_date=trip.get("start_date", ""),
                end_date=trip.get("end_date", ""),
                owner_name=owner_name,
            )

            if member.get("role") == "owner":
                own_trips.append(summary)
            else:
                shared_trips.append(summary)

        return TripsResponse(own_trips=own_trips, shared_trips=shared_trips)
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(
            status_code=500, detail="Failed to fetch trips from DynamoDB"
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


def _query_trip_members(dynamodb, table_name: str, user_id: str) -> List[dict]:
    table = dynamodb.Table(table_name)
    items: List[dict] = []
    last_evaluated_key = None

    while True:
        params = {"KeyConditionExpression": Key("user_id").eq(user_id)}
        if last_evaluated_key:
            params["ExclusiveStartKey"] = last_evaluated_key

        response = table.query(**params)
        items.extend(response.get("Items", []))
        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    return items


def _batch_get_items(
    dynamodb, table_name: str, ids: List[str], key_name: str
) -> List[dict]:
    if not ids:
        return []

    client = dynamodb.meta.client
    results: List[dict] = []

    def _chunks(seq: List[str], size: int = 100):
        for i in range(0, len(seq), size):
            yield seq[i : i + size]

    for chunk in _chunks(ids):
        request = {
            "RequestItems": {
                table_name: {"Keys": [{key_name: item_id} for item_id in chunk]}
            }
        }
        while request["RequestItems"].get(table_name, {}).get("Keys"):
            response = client.batch_get_item(**request)
            results.extend(response.get("Responses", {}).get(table_name, []))
            unprocessed = (
                response.get("UnprocessedKeys", {}).get(table_name, {}).get("Keys")
            )
            request = {"RequestItems": {table_name: {"Keys": unprocessed or []}}}

    return results
