"""
FastAPI router modules for the Peblo TV Mini API.

Each module exposes a `router` that is mounted by `app.main`.
"""

from app.api.admin import router as admin_router
from app.api.admin_publish import router as admin_publish_router
from app.api.artwork import router as artwork_router
from app.api.auth import router as auth_router
from app.api.catalog import router as catalog_router
from app.api.episodes import router as episodes_router
from app.api.seasons import router as seasons_router
from app.api.shows import router as shows_router

__all__ = [
    "admin_publish_router",
    "admin_router",
    "artwork_router",
    "auth_router",
    "catalog_router",
    "episodes_router",
    "seasons_router",
    "shows_router",
]