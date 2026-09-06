"""
Auth-related Pydantic schemas (Phase 5).

These are intentionally minimal: the login request takes email +
password, the login response carries an opaque access token plus
the canonical token type so clients can pattern-match later if/when
refresh tokens are added. The current-user schema is the same shape
as UserRead but lives in this module so future auth-only fields can
extend it without touching the user module.

Note: we deliberately use plain `str` for email (rather than
pydantic.EmailStr) so the project does not pull in the
email-validator package. Email validation is left to the service
layer / DB unique constraint.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Credentials supplied to POST /auth/login."""

    email: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Account email address. Looked up case-sensitively.",
    )
    password: str = Field(
        ...,
        min_length=1,
        max_length=256,
        description="Account password. Never logged or echoed back.",
    )


class LoginResponse(BaseModel):
    """Successful login response."""

    access_token: str = Field(..., description="Opaque access token (JWT).")
    token_type: str = Field(
        default="bearer",
        description="Token type. Always 'bearer' in Phase 5.",
    )


class CurrentUserResponse(BaseModel):
    """The user record behind the bearer token."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Primary key.")
    email: str = Field(..., description="Account email address.")
    role: str = Field(..., description="Authorization role (editor or admin).")


__all__ = [
    "CurrentUserResponse",
    "LoginRequest",
    "LoginResponse",
]