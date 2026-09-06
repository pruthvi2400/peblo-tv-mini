"""
Security primitives: password hashing and JWT access tokens.

This module is the ONLY place that touches the bcrypt / PyJWT APIs.
Routes and services call into the helper functions here so the rest
of the codebase stays free of low-level crypto concerns.

Design notes
------------
* Passwords are hashed with bcrypt (cost factor 12 by default). Bcrypt
  has its own salt; we do not need to store one separately.
* Access tokens are signed with HS256 by default and carry the user id
  and email in `sub` (subject). The token is intentionally short-lived;
  refresh tokens are out of scope for this take-home.
* `JWT_SECRET_KEY` MUST come from environment in production. The
  application startup refuses to run with the development default
  outside of tests.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings


# Bcrypt's 72-byte input ceiling is documented; we still pre-truncate to
# avoid backend-specific surprises on different bcrypt versions.
_BCRYPT_MAX_PASSWORD_BYTES = 72


# ── Password hashing ──────────────────────────────────────────────────────────


def hash_password(plain: str) -> str:
    """
    Hash a plaintext password with bcrypt.

    Returns the encoded hash as a UTF-8 string suitable for storage
    in a VARCHAR column. The salt is generated internally by bcrypt.
    """
    if not isinstance(plain, str) or not plain:
        raise ValueError("password must be a non-empty string")
    raw = plain.encode("utf-8")[:_BCRYPT_MAX_PASSWORD_BYTES]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(raw, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Constant-time comparison of a plaintext password against a stored
    bcrypt hash. Returns False (never raises) on malformed hashes.
    """
    if not plain or not hashed:
        return False
    raw = plain.encode("utf-8")[:_BCRYPT_MAX_PASSWORD_BYTES]
    try:
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── JWT access tokens ─────────────────────────────────────────────────────────


class TokenError(Exception):
    """Raised when an access token is invalid / expired / malformed."""


def create_access_token(
    *,
    subject: str,
    extra_claims: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    """
    Sign a new HS256 access token.

    `subject` is the user identifier that the auth dependency will
    resolve back to a User row. `extra_claims` (e.g. role) is merged
    into the payload so downstream code does not have to re-query.
    """
    now = datetime.now(timezone.utc)
    ttl = expires_minutes or settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl)).timestamp()),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Verify and decode an access token. Raises `TokenError` on any
    signature, expiry, or format problem.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("invalid token") from exc
    if payload.get("type") != "access":
        raise TokenError("invalid token type")
    if not payload.get("sub"):
        raise TokenError("token missing subject")
    return payload


__all__ = [
    "TokenError",
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
]