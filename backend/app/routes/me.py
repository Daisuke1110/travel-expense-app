from datetime import datetime, timezone
from typing import Optional

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import auth
from app.db import get_dynamodb_resource, get_table_names

router = APIRouter()


class MeResponse(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None


class MeUpdateRequest(BaseModel):
    name: str


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validate_name(value: str) -> str:
    name = value.strip()

    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    if len(name) > 50:
        raise HTTPException(
            status_code=400, detail="name must be 50 characters or fewer"
        )

    return name


@router.get("/me", response_model=MeResponse)
def get_me():
    claims = auth.get_current_claims()
    user_id = str(claims.get("sub") or "")
    email = claims.get("email")

    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    tables = get_table_names()
    dynamodb = get_dynamodb_resource()
    users_table = dynamodb.Table(tables["users"])

    try:
        response = users_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        if not item:
            now = _utc_now_iso()
            item = {
                "user_id": user_id,
                "email": email,
                "name": None,
                "created_at": now,
                "updated_at": now,
            }
            users_table.put_item(Item=item)

        return MeResponse(
            user_id=item["user_id"],
            email=item.get("email"),
            name=item.get("name"),
        )
    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch profile") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc


@router.patch("/me", response_model=MeResponse)
def update_me(req: MeUpdateRequest):
    claims = auth.get_current_claims()
    user_id = str(claims.get("sub") or "")
    email = claims.get("email")

    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    name = _validate_name(req.name)

    tables = get_table_names()
    dynamodb = get_dynamodb_resource()
    users_table = dynamodb.Table(tables["users"])

    try:
        now = _utc_now_iso()

        users_table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET #name = :name, email = :email, updated_at = :updated_at",
            ExpressionAttributeNames={"#name": "name"},
            ExpressionAttributeValues={
                ":name": name,
                ":email": email,
                ":updated_at": now,
            },
        )

        response = users_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        if not item:
            raise HTTPException(status_code=404, detail="User not found")

        return MeResponse(
            user_id=item["user_id"],
            email=item.get("email"),
            name=item.get("name"),
        )

    except HTTPException:
        raise
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Failed to update profile") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error") from exc
