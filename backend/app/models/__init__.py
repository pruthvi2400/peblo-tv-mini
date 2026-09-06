"""
SQLAlchemy models for the Peblo TV Mini application.

This module is imported by app.db.base.Base to register all models with Alembic.
Do not import database utilities here — only pure model definitions.
"""

from app.models.base import (
    TimestampMixin,
)
from app.models.user import (
    User,
    UserRole,
)
from app.models.show import (
    Show,
    ShowStatus,
    ShowCategory,
    ShowSection,
    show_categories,
)
from app.models.season import (
    Season,
)
from app.models.episode import (
    Episode,
    EpisodeStatus,
)
from app.models.artwork import (
    Artwork,
    ArtworkType,
)
from app.models.publish import (
    PublishRun,
    PublishStatus,
)

__all__ = [
    # Mixin
    "TimestampMixin",
    # Enums
    "UserRole",
    "ShowStatus",
    "ShowCategory",
    "ShowSection",
    "EpisodeStatus",
    "ArtworkType",
    "PublishStatus",
    # Models
    "User",
    "Show",
    "Season",
    "Episode",
    "Artwork",
    "PublishRun",
    # Association table
    "show_categories",
]
