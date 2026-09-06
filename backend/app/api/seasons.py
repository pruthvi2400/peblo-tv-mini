"""
Season CRUD endpoints.

    GET    /api/seasons                 - paginated list
    POST   /api/seasons                 - create
    GET    /api/seasons/{season_id}     - retrieve
    PUT    /api/seasons/{season_id}     - partial update
    DELETE /api/seasons/{season_id}     - delete

All endpoints require an authenticated editor or admin (Phase 5).
"""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DBSession, EditorDep
from app.core.pagination import clamp_page, clamp_page_size
from app.schemas.season import SeasonCreate, SeasonRead, SeasonUpdate
from app.services import seasons as season_service


router = APIRouter(prefix="/api/seasons", tags=["seasons"])


@router.get("")
def list_seasons(
    db: DBSession,
    _user: EditorDep,
    show_id: Annotated[int | None, Query(ge=1)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Paginated list of seasons, optionally filtered by show_id."""
    page = clamp_page(page)
    page_size = clamp_page_size(page_size)
    items, total = season_service.list_seasons(
        db, page=page, page_size=page_size, show_id=show_id
    )
    return {
        "items": [SeasonRead.model_validate(s) for s in items],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=SeasonRead, status_code=status.HTTP_201_CREATED)
def create_season(payload: SeasonCreate, db: DBSession, _user: EditorDep):
    """Create a season. Returns 404 if show_id is missing, 409 on duplicate season_number."""
    return season_service.create_season(db, payload)


@router.get("/{season_id}", response_model=SeasonRead)
def get_season(season_id: int, db: DBSession, _user: EditorDep):
    """Retrieve a season by id. Returns 404 if absent."""
    return season_service.get_season(db, season_id)


@router.put("/{season_id}", response_model=SeasonRead)
def update_season(season_id: int, payload: SeasonUpdate, db: DBSession, _user: EditorDep):
    """Partial update. Returns 404 / 409 on errors."""
    return season_service.update_season(db, season_id, payload)


@router.delete("/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_season(season_id: int, db: DBSession, _user: EditorDep):
    """Delete a season. Returns 204 on success, 404 if absent."""
    season_service.delete_season(db, season_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]