"""
Episode CRUD endpoints.

    GET    /api/episodes                - paginated list
    POST   /api/episodes                - create
    GET    /api/episodes/{episode_id}   - retrieve
    PUT    /api/episodes/{episode_id}   - partial update
    DELETE /api/episodes/{episode_id}   - delete

Query parameters for list:
    season_id : filter by parent season FK
    show_id   : filter by parent show (joined via Season)
    status    : filter by episode status
    language  : filter by language code
    page      : 1-based page number
    page_size : items per page (max 100)

All endpoints require an authenticated editor or admin (Phase 5).
"""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DBSession, EditorDep
from app.core.enums import LANGUAGE_SET, is_valid_language
from app.core.pagination import clamp_page, clamp_page_size
from app.models.episode import EpisodeStatus
from app.schemas.episode import EpisodeCreate, EpisodeRead, EpisodeUpdate
from app.services import episodes as episode_service
from app.services.errors import ValidationFailure


router = APIRouter(prefix="/api/episodes", tags=["episodes"])


@router.get("")
def list_episodes(
    db: DBSession,
    _user: EditorDep,
    season_id: Annotated[int | None, Query(ge=1)] = None,
    show_id: Annotated[int | None, Query(ge=1)] = None,
    status: Annotated[EpisodeStatus | None, Query()] = None,
    language: Annotated[str | None, Query(max_length=10)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Paginated list of episodes with optional filters."""
    page = clamp_page(page)
    page_size = clamp_page_size(page_size)

    if language is not None and not is_valid_language(language):
        raise ValidationFailure(
            f"language must be one of {sorted(LANGUAGE_SET)}",
            code="invalid_language",
            field="language",
        )

    items, total = episode_service.list_episodes(
        db,
        page=page,
        page_size=page_size,
        season_id=season_id,
        show_id=show_id,
        status=status,
        language=language,
    )
    return {
        "items": [EpisodeRead.model_validate(e) for e in items],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=EpisodeRead, status_code=status.HTTP_201_CREATED)
def create_episode(payload: EpisodeCreate, db: DBSession, _user: EditorDep):
    """
    Create an episode.
    Returns 404 if season_id is missing,
    409 on duplicate (content_group, language),
    422 if published-episode business rules are violated.
    """
    return episode_service.create_episode(db, payload)


@router.get("/{episode_id}", response_model=EpisodeRead)
def get_episode(episode_id: int, db: DBSession, _user: EditorDep):
    """Retrieve an episode by id. Returns 404 if absent."""
    return episode_service.get_episode(db, episode_id)


@router.put("/{episode_id}", response_model=EpisodeRead)
def update_episode(episode_id: int, payload: EpisodeUpdate, db: DBSession, _user: EditorDep):
    """
    Partial update. Returns 404 / 409 / 422 on errors.
    Publish-state validation considers post-update values plus the
    existing artwork records (cannot be edited through this endpoint).
    """
    return episode_service.update_episode(db, episode_id, payload)


@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(episode_id: int, db: DBSession, _user: EditorDep):
    """Delete an episode. Returns 204 on success, 404 if absent."""
    episode_service.delete_episode(db, episode_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]