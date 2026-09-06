"""
Show CRUD endpoints.

    GET    /api/shows              - paginated list
    POST   /api/shows              - create
    GET    /api/shows/{show_id}    - retrieve
    PUT    /api/shows/{show_id}    - partial update
    DELETE /api/shows/{show_id}    - delete

Query parameters for list:
    search        : case-insensitive substring on title
    status        : filter by show status
    section       : filter by platform section
    page          : 1-based page number (default 1)
    page_size     : items per page (default 20, max 100)

All endpoints require an authenticated editor or admin (Phase 5).
"""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DBSession, EditorDep
from app.core.enums import SECTIONS, is_valid_section
from app.core.pagination import clamp_page, clamp_page_size
from app.models.show import ShowStatus
from app.schemas.show import ShowCreate, ShowRead, ShowUpdate
from app.services import shows as show_service
from app.services.errors import ValidationFailure


router = APIRouter(prefix="/api/shows", tags=["shows"])


@router.get("")
def list_shows(
    db: DBSession,
    _user: EditorDep,
    search: Annotated[str | None, Query(max_length=255)] = None,
    status: Annotated[ShowStatus | None, Query()] = None,
    section: Annotated[str | None, Query(max_length=32)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Paginated list of shows with optional filters."""
    page = clamp_page(page)
    page_size = clamp_page_size(page_size)

    if section is not None and not is_valid_section(section):
        raise ValidationFailure(
            f"section must be one of {SECTIONS}",
            code="invalid_section",
            field="section",
        )

    items, total = show_service.list_shows(
        db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        section=section,
    )
    return {
        "items": [ShowRead.model_validate(s) for s in items],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=ShowRead, status_code=status.HTTP_201_CREATED)
def create_show(payload: ShowCreate, db: DBSession, _user: EditorDep):
    """Create a new show. Returns 409 on slug conflict."""
    return show_service.create_show(db, payload)


@router.get("/{show_id}", response_model=ShowRead)
def get_show(show_id: int, db: DBSession, _user: EditorDep):
    """Retrieve a show by id. Returns 404 if absent."""
    return show_service.get_show(db, show_id)


@router.put("/{show_id}", response_model=ShowRead)
def update_show(show_id: int, payload: ShowUpdate, db: DBSession, _user: EditorDep):
    """Partial update. Returns 404 / 409 on errors."""
    return show_service.update_show(db, show_id, payload)


@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_show(show_id: int, db: DBSession, _user: EditorDep):
    """Delete a show. Returns 204 on success, 404 if absent."""
    show_service.delete_show(db, show_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]