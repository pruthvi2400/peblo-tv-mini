"""
Episode CRUD schemas.

- EpisodeCreate: payload for POST /api/episodes
- EpisodeUpdate: payload for PUT /api/episodes/{id}
- EpisodeRead:   response shape for episode resources

Validation notes:
- `language` must be one of LANGUAGES (validated here for clean 422s).
- `duration` must be > 0 when supplied (validated here).
- `artwork` (list of {artwork_type, storage_key}) is optional on input
  but is required when `status == "published"` \u2014 that business rule
  is enforced at the service layer so we can include existing
  artwork on update.
- `(content_group, language)` uniqueness is enforced at the service layer.
"""

from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.core.enums import LANGUAGE_SET
from app.models.artwork import ArtworkType
from app.models.episode import EpisodeStatus


class _EpisodeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    episode_number: int = Field(..., ge=1)
    duration: int | None = Field(default=None, ge=1)
    language: str = Field(default="en", min_length=2, max_length=10)
    content_group: str = Field(..., min_length=1, max_length=255)
    status: EpisodeStatus = Field(default=EpisodeStatus.DRAFT)

    @field_validator("language")
    @classmethod
    def _language_value(cls, v: str) -> str:
        if v not in LANGUAGE_SET:
            raise ValueError(
                f"language must be one of {sorted(LANGUAGE_SET)}"
            )
        return v

    @field_validator("duration")
    @classmethod
    def _duration_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("duration must be a positive integer")
        return v


class EpisodeCreate(_EpisodeBase):
    """Payload for creating an episode."""

    season_id: int = Field(
        ...,
        description="FK to the parent season.",
    )
    artwork: list["ArtworkCreate"] = Field(
        default_factory=list,
        description=(
            "Artwork records to attach. For a published episode, all three "
            "types (poster, banner, thumbnail) must be present."
        ),
    )

    @model_validator(mode="after")
    def _artwork_types_unique(self) -> "EpisodeCreate":
        seen: set[str] = set()
        for aw in self.artwork:
            t = (
                aw.artwork_type.value
                if hasattr(aw.artwork_type, "value")
                else aw.artwork_type
            )
            if t in seen:
                raise ValueError(
                    f"artwork contains duplicate type {t!r}"
                )
            seen.add(t)
        return self


class EpisodeUpdate(BaseModel):
    """Payload for updating an episode (partial updates supported)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    episode_number: int | None = Field(default=None, ge=1)
    duration: int | None = Field(default=None, ge=1)
    language: str | None = Field(default=None, min_length=2, max_length=10)
    content_group: str | None = Field(
        default=None, min_length=1, max_length=255
    )
    status: EpisodeStatus | None = None
    season_id: int | None = None

    @field_validator("language")
    @classmethod
    def _language_value(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in LANGUAGE_SET:
            raise ValueError(
                f"language must be one of {sorted(LANGUAGE_SET)}"
            )
        return v

    @field_validator("duration")
    @classmethod
    def _duration_positive(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("duration must be a positive integer")
        return v


class EpisodeRead(BaseModel):
    """Episode resource returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    season_id: int
    title: str
    episode_number: int
    duration: int | None
    language: str
    content_group: str
    status: EpisodeStatus
    artwork: list["ArtworkRead"] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


__all__ = [
    "EpisodeCreate",
    "EpisodeRead",
    "EpisodeUpdate",
]


# Forward reference for nested schema (resolved at module import time).
from app.schemas.artwork import ArtworkCreate, ArtworkRead  # noqa: E402
