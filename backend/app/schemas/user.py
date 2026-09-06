"""
User schema — read-only stub for Phase 3.

Phase 3 does not implement authentication / user management endpoints,
so this module exposes only the response schema. The actual user
model lives in `app.models.user`.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class UserRead(BaseModel):
    """User account as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="Primary key.")
    email: str = Field(..., description="Login email address.")
    role: UserRole = Field(
        ..., description="Authorization role (editor or admin)."
    )
    created_at: datetime
    updated_at: datetime