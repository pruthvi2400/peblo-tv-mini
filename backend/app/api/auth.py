"""
Authentication endpoints (Phase 5).

    POST /auth/login     - exchange email + password for an access token
    GET  /auth/me        - return the user record behind the bearer token

The login endpoint deliberately returns a generic 401 message on
both "unknown user" and "wrong password" so it cannot be used as a
user-enumeration oracle. The service layer is responsible for that
(see `app.services.auth.authenticate`).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUserDep, DBSession
from app.core.security import create_access_token
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
)
from app.services.auth import AuthError, authenticate


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DBSession) -> LoginResponse:
    """
    Exchange credentials for a JWT access token.

    On success: 200 with `{ "access_token": "...", "token_type": "bearer" }`.
    On failure: 401 with a generic message (never reveals which field
    was wrong).
    """
    try:
        user = authenticate(
            db, email=payload.email, password=payload.password
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    token = create_access_token(
        subject=user.email,
        extra_claims={"role": user.role.value},
    )
    return LoginResponse(access_token=token, token_type="bearer")


@router.get("/me", response_model=CurrentUserResponse)
def me(current: CurrentUserDep) -> CurrentUserResponse:
    """Return the user record behind the bearer token."""
    return CurrentUserResponse.model_validate(current)


__all__ = ["router"]