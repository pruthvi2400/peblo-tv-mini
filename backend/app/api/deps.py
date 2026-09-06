"""
Shared FastAPI dependencies.

These wrappers let tests override the DB session or other dependencies
via `app.dependency_overrides` without monkey-patching the modules.

Phase 5 adds the authentication / authorisation dependencies:
  * `get_current_user`   – resolves the bearer token to a User row
  * `require_editor`     – allows editor OR admin
  * `require_admin`      – allows admin ONLY

Auth errors are converted to structured 401 / 403 responses via the
exception handlers registered in `app.api.errors`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db as _get_db
from app.models.user import User, UserRole
from app.services.auth import get_user_by_email


# ── Database ──────────────────────────────────────────────────────────────────


DBSession = Annotated[Session, Depends(_get_db)]


# ── Authentication / Authorisation ─────────────────────────────────────────────


# `auto_error=False` lets us raise our OWN HTTPException with the
# service-style error envelope instead of FastAPI's default 401.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False,
)


def _unauthorized(detail: str, *, code: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str, *, code: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


def _extract_bearer(token: str | None) -> str:
    if not token:
        raise _unauthorized(
            "Authentication required. Provide a Bearer access token.",
            code="not_authenticated",
        )
    return token


def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: DBSession,
) -> User:
    """
    Decode the bearer token, resolve the user, and return the row.

    Raises 401 on any token problem. NEVER returns a user with a NULL
    password_hash through (those accounts should not exist in the
    first place but the guard is cheap).
    """
    raw = _extract_bearer(token)
    try:
        payload = decode_access_token(raw)
    except TokenError as exc:
        raise _unauthorized(
            "The access token is invalid or has expired.",
            code="invalid_token",
        ) from exc

    subject = payload.get("sub")
    if subject is None:
        raise _unauthorized(
            "The access token is missing a subject claim.",
            code="invalid_token",
        )

    # We persist email-as-string in the token subject so a token can
    # not point at a deleted-and-recycled primary key.
    user = get_user_by_email(db, str(subject))
    if user is None:
        raise _unauthorized(
            "The access token references a user that no longer exists.",
            code="user_not_found",
        )

    if user.password_hash is None or not user.password_hash:
        # Account exists but has no password set; treat as unauthenticated.
        raise _unauthorized(
            "This account has no password set.",
            code="account_not_provisioned",
        )

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_editor(current: CurrentUserDep) -> User:
    """Allow either editor or admin. Reject anyone else."""
    if current.role not in (UserRole.EDITOR, UserRole.ADMIN):
        raise _forbidden(
            "Editor privileges required for this action.",
            code="insufficient_role",
        )
    return current


def require_admin(current: CurrentUserDep) -> User:
    """Allow ONLY admins. Editors (and anyone else) are rejected."""
    if current.role != UserRole.ADMIN:
        raise _forbidden(
            "Admin privileges required for this action.",
            code="insufficient_role",
        )
    return current


EditorDep = Annotated[User, Depends(require_editor)]
AdminDep = Annotated[User, Depends(require_admin)]