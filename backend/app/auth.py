import contextvars
import os
from typing import Any

from fastapi import HTTPException, Request

_current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_id", default=None
)


def _is_debug_header_allowed() -> bool:
    app_env = os.getenv("APP_ENV", "dev").lower()
    allow = os.getenv("ALLOW_DEBUG_USER_HEADER", "true").lower() == "true"
    return app_env != "prod" and allow


def _extract_jwt_sub_from_request(request: Request) -> str | None:
    # API Gateway HTTP API + Lambda(Mangum)のeventからclaimsを取得
    event: dict[str, Any] = request.scope.get("aws.event") or {}
    rc = event.get("requestContext") or {}
    authorizer = rc.get("authorizer") or {}

    # HTTP API JWT Authorizer
    jwt_claims = (authorizer.get("jwt") or {}).get("claims") or {}
    sub = jwt_claims.get("sub")
    if sub:
        return str(sub)

    # 念のため互換パス（Lambda authorizer形式）
    claims = authorizer.get("claims") or {}
    sub = claims.get("sub")
    if sub:
        return str(sub)

    return None


def set_current_user_from_request(request: Request):
    sub = _extract_jwt_sub_from_request(request)
    return _current_user_id.set(sub)


def reset_current_user(token) -> None:
    _current_user_id.reset(token)


def resolve_user_id(x_debug_user_id: str | None) -> str:
    # 1) JWT優先
    sub = _current_user_id.get()
    if sub:
        return sub

    # 2) devのみデバッグヘッダ許可
    if _is_debug_header_allowed() and x_debug_user_id:
        return x_debug_user_id

    raise HTTPException(status_code=401, detail="Unauthorized")
