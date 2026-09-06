"""
Pydantic schemas for the Peblo TV Mini API.

This package groups request/response models by entity:
- common: shared primitives (pagination, message responses, error envelopes)
- user:   user account schema (read-only for Phase 3)
- auth:   login + current-user schemas (Phase 5)
- show:   show CRUD schemas
- season: season CRUD schemas
- episode: episode CRUD schemas
- artwork: artwork record schemas
- publish: publish-run schemas (read-only stubs for Phase 3)
"""

from app.schemas.common import (
    ErrorResponse,
    MessageResponse,
    PaginationParams,
)
from app.schemas.user import UserRead
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
)
from app.schemas.show import (
    ShowCreate,
    ShowRead,
    ShowUpdate,
)
from app.schemas.season import (
    SeasonCreate,
    SeasonRead,
    SeasonUpdate,
)
from app.schemas.episode import (
    EpisodeCreate,
    EpisodeRead,
    EpisodeUpdate,
)
from app.schemas.artwork import (
    ArtworkCreate,
    ArtworkRead,
)
from app.schemas.publish import (
    PublishRunRead,
)

__all__ = [
    # common
    "ErrorResponse",
    "MessageResponse",
    "PaginationParams",
    # user
    "UserRead",
    # auth (Phase 5)
    "CurrentUserResponse",
    "LoginRequest",
    "LoginResponse",
    # show
    "ShowCreate",
    "ShowRead",
    "ShowUpdate",
    # season
    "SeasonCreate",
    "SeasonRead",
    "SeasonUpdate",
    # episode
    "EpisodeCreate",
    "EpisodeRead",
    "EpisodeUpdate",
    # artwork
    "ArtworkCreate",
    "ArtworkRead",
    # publish
    "PublishRunRead",
]