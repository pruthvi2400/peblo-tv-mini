"""
Show service: database logic for show CRUD.

Routes call into this module — they should not query the ORM directly.
This separation keeps validation rules in one place and makes the
service layer easy to unit-test.
"""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.show import Show, ShowCategory, ShowStatus
from app.schemas.show import ShowCreate, ShowUpdate
from app.services.errors import ConflictError, NotFoundError


# ── Helpers ───────────────────────────────────────────────────────────────────
def _apply_categories(show: Show, category_values: Sequence[str]) -> None:
    """Replace the show's category set with the given enum values."""
    show.categories = [
        ShowCategory(c) for c in category_values
    ]


# ── Reads ─────────────────────────────────────────────────────────────────────
def get_show(db: Session, show_id: int) -> Show:
    """Return the show with `id`, eager-loading categories. Raise 404 if absent."""
    stmt = (
        select(Show)
        .options(selectinload(Show._category_rows))
        .where(Show.id == show_id)
    )
    show = db.execute(stmt).scalar_one_or_none()
    if show is None:
        raise NotFoundError(
            f"Show with id={show_id} not found.",
            field="id",
        )
    return show


def list_shows(
    db: Session,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: ShowStatus | None = None,
    section: str | None = None,
) -> tuple[Sequence[Show], int]:
    """
    Return a page of shows plus the total count.

    Filters:
        search: case-insensitive substring match on title.
        status: exact match on show status.
        section: exact match on section enum value (string).
    """
    base = select(Show).options(selectinload(Show._category_rows))

    if search:
        pattern = f"%{search.lower()}%"
        base = base.where(func.lower(Show.title).like(pattern))
    if status is not None:
        base = base.where(Show.status == status)
    if section is not None:
        base = base.where(Show.section == section)

    # Total BEFORE pagination
    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(db.execute(count_stmt).scalar_one() or 0)

    # Page slice
    page_stmt = (
        base.order_by(Show.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.execute(page_stmt).scalars().all()
    return items, total


# ── Writes ────────────────────────────────────────────────────────────────────
def create_show(db: Session, payload: ShowCreate) -> Show:
    """Insert a new show; raise 409 on slug conflict."""
    existing = db.execute(
        select(Show).where(Show.slug == payload.slug)
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError(
            f"A show with slug={payload.slug!r} already exists.",
            code="duplicate_slug",
            field="slug",
        )

    show = Show(
        title=payload.title,
        slug=payload.slug,
        synopsis=payload.synopsis,
        section=payload.section,
        status=payload.status,
    )
    _apply_categories(show, payload.categories)

    db.add(show)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            f"A show with slug={payload.slug!r} already exists.",
            code="duplicate_slug",
            field="slug",
        ) from exc

    db.refresh(show)
    return show


def update_show(
    db: Session, show_id: int, payload: ShowUpdate
) -> Show:
    """Apply a partial update; raise 404 / 409 on errors."""
    show = get_show(db, show_id)

    data = payload.model_dump(exclude_unset=True)

    # Slug conflict check
    new_slug = data.get("slug")
    if new_slug is not None and new_slug != show.slug:
        existing = db.execute(
            select(Show).where(Show.slug == new_slug)
        ).scalar_one_or_none()
        if existing is not None and existing.id != show.id:
            raise ConflictError(
                f"A show with slug={new_slug!r} already exists.",
                code="duplicate_slug",
                field="slug",
            )

    # Apply scalar fields
    for field_name in ("title", "slug", "synopsis", "section", "status"):
        if field_name in data:
            setattr(show, field_name, data[field_name])

    # Categories replace-set
    if "categories" in data:
        _apply_categories(show, data["categories"] or [])

    db.commit()
    db.refresh(show)
    return show


def delete_show(db: Session, show_id: int) -> None:
    """Delete a show (cascades to seasons/episodes). Raise 404 if absent."""
    show = db.get(Show, show_id)
    if show is None:
        raise NotFoundError(
            f"Show with id={show_id} not found.",
            field="id",
        )
    db.delete(show)
    db.commit()


__all__ = [
    "create_show",
    "delete_show",
    "get_show",
    "list_shows",
    "update_show",
]