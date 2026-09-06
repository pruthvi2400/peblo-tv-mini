"""Episode service: database logic for episode CRUD."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.artwork import Artwork, ArtworkType
from app.models.episode import Episode, EpisodeStatus
from app.models.season import Season
from app.schemas.episode import EpisodeCreate, EpisodeUpdate
from app.services.errors import (
    ConflictError,
    NotFoundError,
    ValidationFailure,
)


_REQ = (ArtworkType.POSTER, ArtworkType.BANNER, ArtworkType.THUMBNAIL)


def _ensure_season_exists(db, season_id):
    season = db.get(Season, season_id)
    if season is None:
        raise NotFoundError(
            f"Season with id={season_id} not found.",
            field="season_id",
        )
    return season


def _validate_publish_state(*, status, duration, artwork_types):
    if status != EpisodeStatus.PUBLISHED:
        return
    if duration is None or duration <= 0:
        raise ValidationFailure(
            "A published episode must have a positive duration.",
            code="missing_duration",
            field="duration",
        )
    missing = [t.value for t in _REQ if t not in artwork_types]
    if missing:
        raise ValidationFailure(
            f"A published episode must have artwork records of type(s): {missing}.",
            code="missing_artwork",
            field="artwork",
        )


def get_episode(db, episode_id):
    episode = db.execute(
        select(Episode)
        .options(selectinload(Episode.artwork))
        .where(Episode.id == episode_id)
    ).scalar_one_or_none()
    if episode is None:
        raise NotFoundError(
            f"Episode with id={episode_id} not found.",
            field="id",
        )
    return episode


def list_episodes(
    db, *, page, page_size,
    season_id=None, show_id=None, status=None, language=None,
):
    base = select(Episode).options(selectinload(Episode.artwork))
    if season_id is not None:
        base = base.where(Episode.season_id == season_id)
    if status is not None:
        base = base.where(Episode.status == status)
    if language is not None:
        base = base.where(Episode.language == language)
    if show_id is not None:
        base = base.join(Season, Episode.season_id == Season.id).where(
            Season.show_id == show_id
        )
    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(db.execute(count_stmt).scalar_one() or 0)
    page_stmt = (
        base.order_by(
            Episode.season_id.asc(),
            Episode.episode_number.asc(),
            Episode.id.asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.execute(page_stmt).scalars().all()
    return items, total


def create_episode(db, payload):
    _ensure_season_exists(db, payload.season_id)
    artwork_types = {a.artwork_type for a in payload.artwork}
    _validate_publish_state(
        status=payload.status,
        duration=payload.duration,
        artwork_types=artwork_types,
    )
    episode = Episode(
        season_id=payload.season_id,
        title=payload.title,
        episode_number=payload.episode_number,
        duration=payload.duration,
        language=payload.language,
        content_group=payload.content_group,
        status=payload.status,
    )
    episode.artwork = [
        Artwork(
            artwork_type=a.artwork_type,
            storage_key=a.storage_key,
            width=a.width,
            height=a.height,
            size_bytes=a.size_bytes,
            mime_type=a.mime_type,
        )
        for a in payload.artwork
    ]
    db.add(episode)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            (
                f"An episode with content_group={payload.content_group!r} "
                f"and language={payload.language!r} already exists."
            ),
            code="duplicate_content_language",
            field="content_group",
        ) from exc
    db.refresh(episode)
    return episode


def update_episode(db, episode_id, payload):
    episode = get_episode(db, episode_id)
    data = payload.model_dump(exclude_unset=True)
    new_cg = data.get("content_group", episode.content_group)
    new_lang = data.get("language", episode.language)
    if (new_cg, new_lang) != (episode.content_group, episode.language):
        existing = db.execute(
            select(Episode).where(
                Episode.content_group == new_cg,
                Episode.language == new_lang,
            )
        ).scalar_one_or_none()
        if existing is not None and existing.id != episode.id:
            raise ConflictError(
                (
                    f"An episode with content_group={new_cg!r} "
                    f"and language={new_lang!r} already exists."
                ),
                code="duplicate_content_language",
                field="content_group",
            )
    future_status = EpisodeStatus(data.get("status", episode.status.value))
    future_duration = data.get("duration", episode.duration)
    existing_types = {a.artwork_type for a in episode.artwork}
    _validate_publish_state(
        status=future_status,
        duration=future_duration,
        artwork_types=existing_types,
    )
    if "season_id" in data:
        _ensure_season_exists(db, data["season_id"])
    for field_name in (
        "season_id",
        "title",
        "episode_number",
        "duration",
        "language",
        "content_group",
        "status",
    ):
        if field_name in data:
            setattr(episode, field_name, data[field_name])
    db.commit()
    db.refresh(episode)
    return episode


def delete_episode(db, episode_id):
    episode = db.get(Episode, episode_id)
    if episode is None:
        raise NotFoundError(
            f"Episode with id={episode_id} not found.",
            field="id",
        )
    db.delete(episode)
    db.commit()


__all__ = [
    "create_episode",
    "delete_episode",
    "get_episode",
    "list_episodes",
    "update_episode",
]
