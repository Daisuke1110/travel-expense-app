import contextvars
import os
from typing import Any

from fastapi import HTTPException, Request

_current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_user_id", default=None
)
_current_claims: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "current_claims", default=None
)


def _is_debug_header_allowed() -> bool:
    app_env = os.getenv("APP_ENV", "dev").lower()
    allow = os.getenv("ALLOW_DEBUG_USER_HEADER", "true").lower() == "true"
    return app_env != "prod" and allow


def _extract_jwt_claims_from_request(request: Request) -> dict[str, Any] | None:
    event: dict[str, Any] = request.scope.get("aws.event") or {}
    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}

    jwt_claims = (authorizer.get("jwt") or {}).get("claims") or {}
    if jwt_claims:
        return {str(key): value for key, value in jwt_claims.items()}

    claims = authorizer.get("claims") or {}
    if claims:
        return {str(key): value for key, value in claims.items()}

    return None


def set_current_user_from_request(request: Request):
    claims = _extract_jwt_claims_from_request(request)
    claims_token = _current_claims.set(claims)

    sub = None
    if claims:
        sub = claims.get("sub")
    if sub is not None:
        sub = str(sub)

    user_token = _current_user_id.set(sub)
    return user_token, claims_token


def reset_current_user(tokens) -> None:
    user_token, claims_token = tokens
    _current_user_id.reset(user_token)
    _current_claims.reset(claims_token)


def get_current_claims() -> dict[str, Any]:
    claims = _current_claims.get()
    if claims:
        return claims
    raise HTTPException(status_code=401, detail="Unauthorized")


def resolve_user_id(x_debug_user_id: str | None) -> str:
    sub = _current_user_id.get()
    if sub:
        return sub

    if _is_debug_header_allowed() and x_debug_user_id:
        return x_debug_user_id

    raise HTTPException(status_code=401, detail="Unauthorized")
