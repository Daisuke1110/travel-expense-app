from typing import Dict, List

from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Header, HTTPException, Path, Response
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime, timezone
import uuid
import re

from app.db import get_dynamodb_resource, get_table_names

router = APIRouter()


# クラス一覧
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


class TripDetail(BaseModel):
    trip_id: str
    title: str
    country: str
    start_date: str
    end_date: str
    base_currency: str
    rate_to_jpy: float
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None


class ExpenseItem(BaseModel):
    expense_id: str
    trip_id: str
    user_id: str
    amount: int
    currency: str
    category: Optional[str] = None
    note: Optional[str] = None
    datetime: str
    datetime_expense_id: str
    created_at: Optional[str] = None


class ExpensesResponse(BaseModel):
    expenses: List[ExpenseItem]


class TripCreateRequest(BaseModel):
    title: str
    country: str
    start_date: str
    end_date: str
    base_currency: str
    rate_to_jpy: float | int | str


class TripUpdateRequest(BaseModel):
    title: str | None = None
    country: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    rate_to_jpy: float | int | str | None = None
    base_currency: str | None = None


class TripMemberCreateRequest(BaseModel):
    user_id: str


class TripMemberResponse(BaseModel):
    user_id: str
    trip_id: str
    role: str
    joined_at: str


class ExpenseCreateRequest(BaseModel):
    amount: int | float | str
    currency: str
    category: Optional[str] = None
    note: Optional[str] = None
    datetime: str


class ExpenseUpdateRequest(BaseModel):
    amount: int | float | str | None = None
    currency: str | None = None
    category: Optional[str] = None
    note: Optional[str] = None
    datetime: str | None = None


_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")


## 関数一覧
def _get_user_id(x_debug_user_id: str | None) -> str:
    if not x_debug_user_id:
        raise HTTPException(
            status_code=401, detail="X-Debug-User-Id header is required in MVP mode"
        )
    return x_debug_user_id


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


def _get_trip_or_404(dynamodb, table_name: str, trip_id: str) -> dict:
    response = dynamodb.Table(table_name).get_item(Key={"trip_id": trip_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Trip not found")
    return item


def _ensure_member_or_forbid(
    dynamodb, table_name: str, user_id: str, trip_id: str
) -> dict:
    """
    Ensure the user is a member of the trip (TripMembers PK=user_id, SK=trip_id).
    """
    response = dynamodb.Table(table_name).get_item(
        Key={"user_id": user_id, "trip_id": trip_id}
    )
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=403, detail="Forbidden")
    return item


def _ensure_member(dynamodb, table_name: str, user_id: str, trip_id: str):
    res = dynamodb.Table(table_name).get_item(
        Key={"user_id": user_id, "trip_id": trip_id}
    )
    if "Item" not in res:
        raise HTTPException(status_code=403, detail="Forbidden")
    return res["Item"]


def _ensure_owner(dynamodb, table_name: str, user_id: str, trip_id: str):
    item = _ensure_member(dynamodb, table_name, user_id, trip_id)
    if item.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Forbidden")
    return item


def _get_owner_name(
    dynamodb, users_table: str, owner_id: Optional[str]
) -> Optional[str]:
    if not owner_id:
        return None
    response = dynamodb.Table(users_table).get_item(Key={"user_id": owner_id})
    item = response.get("Item") or {}
    return item.get("name", "owner")


def _as_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _as_int(value):
    if isinstance(value, Decimal):
        return int(value)
    return int(value) if value is not None else value


def _parse_iso_date(value: str, field_name: str) -> str:
    try:
        date.fromisoformat(value)
        return value
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"{field_name} must be ISO8601 date"
        ) from exc


def _validate_base_currency(value: str) -> str:
    if not _CURRENCY_RE.match(value):
        raise HTTPException(
            status_code=400, detail="base_currency must be 3 uppercase letters"
        )
    return value


# 少数では為替が整数だった場合どうするのか問題？
def _parse_rate_to_jpy(value) -> Decimal:
    if isinstance(value, bool):
        raise HTTPException(status_code=400, detail="rate_to_jpy must be decimal")
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, TypeError) as exc:
        raise HTTPException(
            status_code=400, detail="rate_to_jpy must be decimal"
        ) from exc
    if dec == dec.to_integral_value():
        raise HTTPException(status_code=400, detail="rate_to_jpy must be decimal")
    return dec


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _delete_trip_members_by_trip_id(dynamodb, table_name: str, trip_id: str):
    table = dynamodb.Table(table_name)
    last_evaluated_key = None

    while True:
        params = {
            "IndexName": "GSI1",
            "KeyConditionExpression": Key("trip_id").eq(trip_id),
        }
        if last_evaluated_key:
            params["ExclusiveStartKey"] = last_evaluated_key

        resp = table.query(**params)
        items = resp.get("Items", [])
        if items:
            with table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(
                        Key={"user_id": item["user_id"], "trip_id": item["trip_id"]}
                    )

        last_evaluated_key = resp.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break


def _delete_expenses_by_trip_id(dynamodb, table_name: str, trip_id: str):
    table = dynamodb.Table(table_name)
    last_evaluated_key = None

    while True:
        params = {"KeyConditionExpression": Key("trip_id").eq(trip_id)}
        if last_evaluated_key:
            params["ExclusiveStartKey"] = last_evaluated_key

        resp = table.query(**params)
        items = resp.get("Items", [])

        if items:
            with table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(
                        Key={
                            "trip_id": item["trip_id"],
                            "datetime_expense_id": item["datetime_expense_id"],
                        }
                    )

        last_evaluated_key = resp.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break


def _parse_amount_int(value) -> int:
    if isinstance(value, bool):
        raise HTTPException(status_code=400, detail="amount must be integer")
    try:
        dec = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="amount must be integer") from exc
    if dec != dec.to_integral_value():
        raise HTTPException(status_code=400, detail="amount must be integer")
    return int(dec)


def _parse_datetime_utc(value: str) -> str:
    if not value.endswith("Z"):
        raise HTTPException(status_code=400, detail="datetime must be ISO8601 UTC")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="datetime must be ISO8601 UTC"
        ) from exc
    if dt.tzinfo is None or dt.utcoffset() != timezone.utc.utcoffset(dt):
        raise HTTPException(status_code=400, detail="datetime must be ISO8601 UTC")
    return value


def _get_expense_by_id(dynamodb, table_name: str, expense_id: str) -> dict:
    table = dynamodb.Table(table_name)
    resp = table.query(
        IndexName="GSI1",
        KeyConditionExpression=Key("expense_id").eq(expense_id),
        Limit=1,
    )
    items = resp.get("Items", [])
    if not items:
        raise HTTPException(status_code=404, detail="Expense not found")
    return items[0]


# デコレーター
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


@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip_detail(
    trip_id: str = Path(..., description="Trip ID"),
    x_debug_user_id: str | None = Header(default=None),
):
    """
    Get trip detail. Only members of the trip can view.
    """
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        trip = _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_member_or_forbid(dynamodb, tables["trip_members"], user_id, trip_id)
        owner_name = _get_owner_name(dynamodb, tables["users"], trip.get("owner_id"))

        return TripDetail(
            trip_id=trip.get("trip_id", ""),
            title=trip.get("title", ""),
            country=trip.get("country", ""),
            start_date=trip.get("start_date", ""),
            end_date=trip.get("end_date", ""),
            base_currency=trip.get("base_currency", ""),
            rate_to_jpy=_as_float(trip.get("rate_to_jpy", 0.0)),
            owner_id=trip.get("owner_id"),
            owner_name=owner_name or "owner",
        )
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch trip") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.get("/trips/{trip_id}/expenses", response_model=ExpensesResponse)
def list_expenses(
    trip_id: str = Path(..., description="Trip ID"),
    x_debug_user_id: str | None = Header(default=None),
):
    """
    List expenses for a trip. Only members can view.
    """
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_member_or_forbid(dynamodb, tables["trip_members"], user_id, trip_id)
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch trip") from exc

    try:
        table = dynamodb.Table(tables["expenses"])
        items: List[dict] = []
        last_evaluated_key = None
        while True:
            params = {
                "KeyConditionExpression": Key("trip_id").eq(trip_id),
                "ScanIndexForward": True,
            }
            if last_evaluated_key:
                params["ExclusiveStartKey"] = last_evaluated_key
            resp = table.query(**params)
            items.extend(resp.get("Items", []))
            last_evaluated_key = resp.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

        expenses: List[ExpenseItem] = []
        for item in items:
            expenses.append(
                ExpenseItem(
                    expense_id=item.get("expense_id", ""),
                    trip_id=item.get("trip_id", ""),
                    user_id=item.get("user_id", ""),
                    amount=_as_int(item.get("amount", 0)),
                    currency=item.get("currency", ""),
                    category=item.get("category"),
                    note=item.get("note"),
                    datetime=item.get("datetime", ""),
                    datetime_expense_id=item.get("datetime_expense_id", ""),
                    created_at=item.get("created_at"),
                )
            )

        return ExpensesResponse(expenses=expenses)
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch expenses") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.post("/trips", response_model=TripDetail)
def create_trip(
    req: TripCreateRequest, x_debug_user_id: str | None = Header(default=None)
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    start_date = _parse_iso_date(req.start_date, "start_date")
    end_date = _parse_iso_date(req.end_date, "end_date")
    base_currency = _validate_base_currency(req.base_currency)
    rate_to_jpy = _parse_rate_to_jpy(req.rate_to_jpy)

    trip_id = str(uuid.uuid4())
    created_at = _utc_now_iso()

    trip_item = {
        "trip_id": trip_id,
        "owner_id": user_id,
        "title": req.title,
        "country": req.country,
        "start_date": start_date,
        "end_date": end_date,
        "base_currency": base_currency,
        "rate_to_jpy": rate_to_jpy,
        "created_at": created_at,
    }

    member_item = {
        "user_id": user_id,
        "trip_id": trip_id,
        "role": "owner",
        "joined_at": created_at,
    }

    try:
        dynamodb.Table(tables["trips"]).put_item(Item=trip_item)
        dynamodb.Table(tables["trip_members"]).put_item(Item=member_item)
        return TripDetail(
            trip_id=trip_id,
            title=req.title,
            country=req.country,
            start_date=start_date,
            end_date=end_date,
            base_currency=base_currency,
            rate_to_jpy=float(rate_to_jpy),
            owner_id=user_id,
            owner_name="owner",
        )
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to create trip") from exc


@router.patch("/trips/{trip_id}", response_model=TripDetail)
def update_trip(
    trip_id: str = Path(..., description="Trip ID"),
    req: TripUpdateRequest = ...,
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        trip = _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_owner(dynamodb, tables["trip_members"], user_id, trip_id)

        if req.base_currency is not None and req.base_currency != trip.get(
            "base_currency"
        ):
            raise HTTPException(
                status_code=400, detail="base_currency cannot be changed"
            )

        update_values: dict[str, object] = {}
        if req.title is not None:
            update_values["title"] = req.title
        if req.country is not None:
            update_values["country"] = req.country
        if req.start_date is not None:
            update_values["start_date"] = _parse_iso_date(req.start_date, "start_date")
        if req.end_date is not None:
            update_values["end_date"] = _parse_iso_date(req.end_date, "end_date")
        if req.rate_to_jpy is not None:
            update_values["rate_to_jpy"] = _parse_rate_to_jpy(req.rate_to_jpy)

        if not update_values:
            raise HTTPException(status_code=400, detail="No fields to update")

        expr_names = {}
        expr_values = {}
        sets = []
        for key, value in update_values.items():
            name_key = f"#{key}"
            value_key = f":{key}"
            expr_names[name_key] = key
            expr_values[value_key] = value
            sets.append(f"{name_key} = {value_key}")

        response = dynamodb.Table(tables["trips"]).update_item(
            Key={"trip_id": trip_id},
            UpdateExpression="SET " + ", ".join(sets),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
            ReturnValues="ALL_NEW",
        )

        updated = response.get("Attributes", {})
        owner_name = _get_owner_name(dynamodb, tables["users"], updated.get("owner_id"))

        return TripDetail(
            trip_id=updated.get("trip_id", trip_id),
            title=updated.get("title", ""),
            country=updated.get("country", ""),
            start_date=updated.get("start_date", ""),
            end_date=updated.get("end_date", ""),
            base_currency=updated.get("base_currency", ""),
            rate_to_jpy=_as_float(updated.get("rate_to_jpy", 0.0)),
            owner_id=updated.get("owner_id"),
            owner_name=owner_name or "owner",
        )
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to update trip") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.delete("/trips/{trip_id}", status_code=204)
def delete_trip(
    trip_id: str = Path(..., description="Trip ID"),
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_owner(dynamodb, tables["trip_members"], user_id, trip_id)

        dynamodb.Table(tables["trips"]).delete_item(Key={"trip_id": trip_id})
        _delete_trip_members_by_trip_id(dynamodb, tables["trip_members"], trip_id)
        _delete_expenses_by_trip_id(dynamodb, tables["expenses"], trip_id)

        return Response(status_code=204)
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to delete trip") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.post("/trips/{trip_id}/members", response_model=TripMemberResponse)
def add_member(
    trip_id: str = Path(..., description="Trip_ID"),
    req: TripMemberCreateRequest = ...,
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_owner(dynamodb, tables["trip_members"], user_id, trip_id)

        joined_at = _utc_now_iso()
        member_item = {
            "user_id": req.user_id,
            "trip_id": trip_id,
            "role": "member",
            "joined_at": joined_at,
        }

        dynamodb.Table(tables["trip_members"]).put_item(
            Item=member_item,
            ConditionExpression="attribute_not_exists(user_id) AND attribute_not_exists(trip_id)",
        )

        return TripMemberResponse(
            user_id=req.user_id, trip_id=trip_id, role="member", joined_at=joined_at
        )

    except HTTPException:
        raise
    except ClientError as exc:
        if (
            exc.response.get("Error", {}).get("Code")
            == "ConditionalCheckFailedException"
        ):
            raise HTTPException(
                status_code=409, detail="Member already exists"
            ) from exc
        raise HTTPException(status_code=500, detail="Failed to add member") from exc
    except BotoCoreError as exc:
        raise HTTPException(status_code=500, detail="Failed to add member")


@router.post("/trips/{trip_id}/expenses", response_model=ExpenseItem)
def create_expense(
    trip_id: str = Path(..., description="Trip ID"),
    req: ExpenseCreateRequest = ...,
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        trip = _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_member_or_forbid(dynamodb, tables["trip_members"], user_id, trip_id)

        if req.currency != trip.get("base_currency"):
            raise HTTPException(
                status_code=400, detail="currency must match base_currency"
            )

        amount = _parse_amount_int(req.amount)
        datetime_value = _parse_datetime_utc(req.datetime)

        expense_id = str(uuid.uuid4())
        datetime_expense_id = f"{datetime_value}#{expense_id}"
        created_at = _utc_now_iso()

        item = {
            "trip_id": trip_id,
            "datetime_expense_id": datetime_expense_id,
            "expense_id": expense_id,
            "datetime": datetime_value,
            "user_id": user_id,
            "amount": Decimal(amount),
            "currency": req.currency,
            "category": req.category,
            "note": req.note,
            "created_at": created_at,
        }

        dynamodb.Table(tables["expenses"]).put_item(Item=item)

        return ExpenseItem(
            expense_id=expense_id,
            trip_id=trip_id,
            user_id=user_id,
            amount=amount,
            currency=req.currency,
            category=req.category,
            note=req.note,
            datetime=datetime_value,
            datetime_expense_id=datetime_expense_id,
            created_at=created_at,
        )
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to create expense") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.patch("/trips/{trip_id}/expenses/{expense_id}", response_model=ExpenseItem)
def update_expense(
    trip_id: str = Path(..., description="Trip ID"),
    expense_id: str = Path(..., description="Expense ID"),
    req: ExpenseUpdateRequest = ...,
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        trip = _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_member_or_forbid(dynamodb, tables["trip_members"], user_id, trip_id)

        expense = _get_expense_by_id(dynamodb, tables["expenses"], expense_id)
        if expense.get("trip_id") != trip_id:
            raise HTTPException(status_code=404, detail="Expense not found")

        if req.currency is not None and req.currency != trip.get("base_currency"):
            raise HTTPException(
                status_code=400, detail="currency must match base_currency"
            )

        update_values: dict[str, object] = {}
        if req.amount is not None:
            update_values["amount"] = Decimal(_parse_amount_int(req.amount))
        if req.currency is not None:
            update_values["currency"] = req.currency
        if req.category is not None:
            update_values["category"] = req.category
        if req.note is not None:
            update_values["note"] = req.note

        new_datetime = None
        if req.datetime is not None:
            new_datetime = _parse_datetime_utc(req.datetime)

        if not update_values and new_datetime is None:
            raise HTTPException(status_code=400, detail="No fields to update")

        table = dynamodb.Table(tables["expenses"])

        if new_datetime is not None and new_datetime != expense.get("datetime"):
            new_datetime_expense_id = f"{new_datetime}#{expense_id}"
            new_item = {
                "trip_id": trip_id,
                "datetime_expense_id": new_datetime_expense_id,
                "expense_id": expense_id,
                "datetime": new_datetime,
                "user_id": expense.get("user_id"),
                "amount": update_values.get("amount", expense.get("amount")),
                "currency": update_values.get("currency", expense.get("currency")),
                "category": update_values.get("category", expense.get("category")),
                "note": update_values.get("note", expense.get("note")),
                "created_at": expense.get("created_at"),
            }
            table.put_item(Item=new_item)
            table.delete_item(
                Key={
                    "trip_id": expense["trip_id"],
                    "datetime_expense_id": expense["datetime_expense_id"],
                }
            )
            updated = new_item
        else:

            expr_names = {}
            expr_values = {}
            sets = []
            for key, value in update_values.items():
                name_key = f"#{key}"
                value_key = f":{key}"
                expr_names[name_key] = key
                expr_values[value_key] = value
                sets.append(f"{name_key} = {value_key}")

            if sets:
                resp = table.update_item(
                    Key={
                        "trip_id": expense["trip_id"],
                        "datetime_expense_id": expense["datetime_expense_id"],
                    },
                    UpdateExpression="SET " + ", ".join(sets),
                    ExpressionAttributeNames=expr_names,
                    ExpressionAttributeValues=expr_values,
                    ReturnValues="ALL_NEW",
                )
                updated = resp.get("Attributes", {})
            else:
                updated = expense

        return ExpenseItem(
            expense_id=updated.get("expense_id", ""),
            trip_id=updated.get("trip_id", ""),
            user_id=updated.get("user_id", ""),
            amount=_as_int(updated.get("amount", 0)),
            currency=updated.get("currency", ""),
            category=updated.get("category"),
            note=updated.get("note"),
            datetime=updated.get("datetime", ""),
            datetime_expense_id=updated.get("datetime_expense_id", ""),
            created_at=updated.get("created_at"),
        )

    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to update expense") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected Error")


@router.delete("/trips/{trip_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    trip_id: str = Path(..., description="Trip ID"),
    expense_id: str = Path(..., description="Expense ID"),
    x_debug_user_id: str | None = Header(default=None),
):
    user_id = _get_user_id(x_debug_user_id)
    tables = get_table_names()
    dynamodb = get_dynamodb_resource()

    try:
        _get_trip_or_404(dynamodb, tables["trips"], trip_id)
        _ensure_member_or_forbid(dynamodb, tables["trip_members"], user_id, trip_id)
        expense = _get_expense_by_id(dynamodb, tables["expenses"], expense_id)
        if expense["trip_id"] != trip_id:
            raise HTTPException(status_code=404, detail="Expense not fount")

        dynamodb.Table(tables["expenses"]).delete_item(
            Key={
                "trip_id": expense["trip_id"],
                "datetime_expense_id": expense["datetime_expense_id"],
            }
        )

    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to delete expense") from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Unexpected error")
