"""
Publish-run schemas (read-only for Phase 3).

The CRUD API for publish runs is out of scope. We only expose the
read schema so the model is importable and consistent with the rest
of the API surface.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.publish import PublishStatus


class PublishRunRead(BaseModel):
    """Publish-run resource as returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    triggered_by_user_id: int | None
    started_at: datetime
    completed_at: datetime | None
    status: PublishStatus
    shows_count: int | None
    seasons_count: int | None
    episodes_count: int | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


__all__ = ["PublishRunRead"]