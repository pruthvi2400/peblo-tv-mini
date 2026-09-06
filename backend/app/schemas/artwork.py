"""
Artwork CRUD schemas.

- ArtworkCreate: payload for POST /api/episodes/{id}/artwork (Phase 4+)
- ArtworkRead:   response shape for artwork records

The artwork upload endpoint itself is not in scope for Phase 3, but the
schema is exposed so the seed loader and episode endpoints can return
artwork metadata alongside episode payloads.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.artwork import ArtworkType


class ArtworkCreate(BaseModel):
    """Payload for creating an artwork record."""

    artwork_type: ArtworkType
    storage_key: str = Field(..., min_length=1, max_length=512)
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    size_bytes: int | None = Field(default=None, ge=1)
    mime_type: str = Field(default="image/jpeg", max_length=50)


class ArtworkRead(BaseModel):
    """Artwork resource returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_id: int
    artwork_type: ArtworkType
    storage_key: str
    width: int | None
    height: int | None
    size_bytes: int | None
    mime_type: str
    created_at: datetime
    updated_at: datetime


__all__ = [
    "ArtworkCreate",
    "ArtworkRead",
]