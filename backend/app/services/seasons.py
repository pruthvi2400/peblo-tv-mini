"""
Season service: database logic for season CRUD.

Routes call into this module — they should not query the ORM directly.
"""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.season import Season
from app.models.show import Show
from app.schemas.season import SeasonCreate, SeasonUpdate
from app.services.errors import ConflictError, NotFoundError


# ── Helpers ───────────────────────────────────────────────────────────────────
def _ensure_show_exists(db: Session, show_id: int) -> None:
    if db.get(Show, show_id) is None:
        raise NotFoundError(
            f"Show with id={show_id} not found.",
            field="show_id",
        )


# ── Reads ─────────────────────────────────────────────────────────────────────
def get_season(db: Session, season_id: int) -> Season:
    season = db.get(Season, season_id)
    if season is None:
        raise NotFoundError(
            f"Season with id={season_id} not found.",
            field="id",
        )
    return season


def list_seasons(
    db: Session,
    *,
    page: int,
    page_size: int,
    show_id: int | None = None,
) -> tuple[Sequence[Season], int]:
    """
    Paginated list of seasons, optionally filtered by show.
    """
    base = select(Season)
    if show_id is not None:
        base = base.where(Season.show_id == show_id)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(db.execute(count_stmt).scalar_one() or 0)

    page_stmt = (
        base.order_by(Season.show_id.asc(), Season.season_number.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.execute(page_stmt).scalars().all()
    return items, total


# ── Writes ────────────────────────────────────────────────────────────────────
def create_season(db: Session, payload: SeasonCreate) -> Season:
    _ensure_show_exists(db, payload.show_id)

    season = Season(
        show_id=payload.show_id,
        season_number=payload.season_number,
    )
    db.add(season)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            f"Season {payload.season_number} already exists for show_id={payload.show_id}.",
            code="duplicate_season_number",
            field="season_number",
        ) from exc

    db.refresh(season)
    return season


def update_season(
    db: Session, season_id: int, payload: SeasonUpdate
) -> Season:
    season = get_season(db, season_id)

    data = payload.model_dump(exclude_unset=True)
    if "season_number" in data and data["season_number"] != season.season_number:
        season.season_number = data["season_number"]
    db.commit()
    db.refresh(season)
    return season


def delete_season(db: Session, season_id: int) -> None:
    season = db.get(Season, season_id)
    if season is None:
        raise NotFoundError(
            f"Season with id={season_id} not found.",
            field="id",
        )
    db.delete(season)
    db.commit()


__all__ = [
    "create_season",
    "delete_season",
    "get_season",
    "list_seasons",
    "update_season",
]