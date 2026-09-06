"""
Season CRUD schemas.

- SeasonCreate: payload for POST /api/seasons
- SeasonUpdate: payload for PUT /api/seasons/{id}
- SeasonRead:   response shape for season resources

Validation notes:
- `season_number` must be >= 0 (0 is reserved for trailers).
- `(show_id, season_number)` uniqueness is enforced at the service layer.
"""

from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.models.season import Season


class _SeasonBase(BaseModel):
    show_id: int = Field(
        ...,
        description="FK to the parent show.",
    )
    season_number: int = Field(
        ...,
        ge=0,
        description=(
            "Season ordinal. 0 = trailers, 1 = first season, etc. "
            "Must be unique within a show."
        ),
    )

    @field_validator("season_number")
    @classmethod
    def _non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("season_number must be >= 0")
        return v


class SeasonCreate(_SeasonBase):
    """Payload for creating a season."""


class SeasonUpdate(BaseModel):
    """Payload for updating a season (only `season_number` is mutable)."""

    season_number: int | None = Field(default=None, ge=0)

    @field_validator("season_number")
    @classmethod
    def _non_negative(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 0:
            raise ValueError("season_number must be >= 0")
        return v


class SeasonRead(BaseModel):
    """Season resource returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    show_id: int
    season_number: int
    created_at: datetime
    updated_at: datetime


__all__ = [
    "SeasonCreate",
    "SeasonRead",
    "SeasonUpdate",
]