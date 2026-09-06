"""Seed loader for seed_shows.json.

Reads seed_shows.json, groups records by show slug, then upserts
Show -> Season -> Episode -> Artwork records.

Deterministic rules
-------------------

* Shows: created (or refreshed) per slug.
* Seasons: created by (show_id, season_number). First row wins.
* Episodes: created by (content_group, language).
  - On collision (e.g. ep_0004 vs ep_9001 both have
    content_group="motis-many-lives-s01e02", language="hi"),
    the FIRST valid row wins; subsequent colliding rows are recorded
    in `SeedResult.episode_conflicts` and NOT inserted. The existing
    episode's data is NOT overwritten.
* Artwork: created only for the artwork types explicitly listed in the
  source row's `artwork_available` array. Missing artwork records are
  NOT back-filled -- the seed deliberately contains imperfect rows so
  that a future validation-report endpoint can surface them.
* Show.status: a show is "published" if AT LEAST ONE row in its seed
  group has status="published"; otherwise "draft". This is the
  documented rule and is deterministic.

Note: source `episode_id` values are not preserved as columns. The
data model has no `source_episode_id` column; episode identity is the
database id plus the unique (content_group, language) pair.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.artwork import Artwork, ArtworkType
from app.models.episode import Episode, EpisodeStatus
from app.models.season import Season
from app.models.show import Show, ShowCategory, ShowSection, ShowStatus


logger = logging.getLogger(__name__)


@dataclass
class EpisodeConflict:
    """A seed row rejected because (content_group, language) was taken.

    Fields:
        episode_id: Source episode_id of the rejected row.
        content_group, language: the colliding key.
        kept_episode_id: Source episode_id of the row that won.
        reason: fixed code (e.g. "duplicate_content_language").
    """

    episode_id: str
    content_group: str
    language: str
    kept_episode_id: str
    reason: str = "duplicate_content_language"


@dataclass
class SeedResult:
    shows_created: int = 0
    shows_updated: int = 0
    seasons_created: int = 0
    seasons_existing: int = 0
    episodes_created: int = 0
    episodes_existing: int = 0
    artwork_created: int = 0
    artwork_existing: int = 0
    skipped_rows: int = 0
    episode_conflicts: list[EpisodeConflict] = field(default_factory=list)

    def to_dict(self):
        return {
            "shows_created": self.shows_created,
            "shows_updated": self.shows_updated,
            "seasons_created": self.seasons_created,
            "seasons_existing": self.seasons_existing,
            "episodes_created": self.episodes_created,
            "episodes_existing": self.episodes_existing,
            "artwork_created": self.artwork_created,
            "artwork_existing": self.artwork_existing,
            "skipped_rows": self.skipped_rows,
            "episode_conflicts": [
                {
                    "episode_id": c.episode_id,
                    "content_group": c.content_group,
                    "language": c.language,
                    "kept_episode_id": c.kept_episode_id,
                    "reason": c.reason,
                }
                for c in self.episode_conflicts
            ],
        }


def _load_records(seed_path):
    with seed_path.open("r", encoding="utf-8") as f:
        records = json.load(f)
    if not isinstance(records, list):
        raise ValueError(
            f"seed file {seed_path} must contain a JSON array; "
            f"got {type(records).__name__}."
        )
    return records


def _existing_artwork_types(episode):
    return {a.artwork_type for a in episode.artwork}


def _get_or_create_show(
    db, *, slug, title, synopsis, section_value, status_value, categories, result
):
    show = db.execute(
        select(Show).where(Show.slug == slug)
    ).scalar_one_or_none()
    if show is None:
        show = Show(
            slug=slug,
            title=title,
            synopsis=synopsis,
            section=ShowSection(section_value),
            status=ShowStatus(status_value),
        )
        show.categories = [ShowCategory(c) for c in categories]
        db.add(show)
        db.flush()
        result.shows_created += 1
    else:
        # Idempotent refresh of scalar values.
        show.title = title
        show.synopsis = synopsis
        show.section = ShowSection(section_value)
        show.status = ShowStatus(status_value)
        show.categories = [ShowCategory(c) for c in categories]
        result.shows_updated += 1
    return show


def _get_or_create_season(db, *, show, season_number, result):
    season = db.execute(
        select(Season).where(
            Season.show_id == show.id,
            Season.season_number == season_number,
        )
    ).scalar_one_or_none()
    if season is None:
        season = Season(show_id=show.id, season_number=season_number)
        db.add(season)
        db.flush()
        result.seasons_created += 1
    else:
        result.seasons_existing += 1
    return season


def _create_episode(
    db, *, season, content_group, language, title,
    episode_number, duration, status_value, result
):
    episode = Episode(
        season_id=season.id,
        content_group=content_group,
        language=language,
        title=title,
        episode_number=episode_number,
        duration=duration,
        status=EpisodeStatus(status_value),
    )
    db.add(episode)
    db.flush()
    result.episodes_created += 1
    return episode


def _attach_artwork(db, *, episode, artwork_types, result):
    """Insert artwork records ONLY for types in `artwork_types`.

    The seed's `artwork_available` array is the source of truth: no
    synthetic records are created for missing types. Missing artwork
    remains detectable by the future validation-report endpoint.
    """
    existing_types = _existing_artwork_types(episode)
    for atype in artwork_types:
        atype_enum = ArtworkType(atype)
        if atype_enum in existing_types:
            result.artwork_existing += 1
            continue
        storage_key = f"seed/{episode.content_group}/{atype}.jpg"
        db.add(
            Artwork(
                episode_id=episode.id,
                artwork_type=atype_enum,
                storage_key=storage_key,
                mime_type="image/jpeg",
            )
        )
        result.artwork_created += 1


def load_seed_shows(db, seed_path):
    """
    Load seed_shows.json into the database (idempotent + deterministic).

    Returns a SeedResult with counters AND a list of episode
    collisions (rows rejected because (content_group, language) was
    already taken). The first valid row for a given collision pair
    wins; subsequent colliding rows are recorded but NOT inserted.
    Raises ValueError if the file is malformed.
    """
    seed_path = Path(seed_path)
    records = _load_records(seed_path)
    result = SeedResult()

    by_slug = defaultdict(list)
    for rec in records:
        slug = rec.get("slug")
        if not slug:
            logger.warning("Skipping seed record without slug: %r", rec)
            result.skipped_rows += 1
            continue
        by_slug[slug].append(rec)

    # Pre-scan: for each (content_group, language) key, remember the
    # source episode_id of the FIRST row that claims it. Subsequent
    # rows for the same key are losers and will be recorded as
    # conflicts (not inserted).
    winners: dict[tuple[str, str], str] = {}
    for _rec in records:
        cg = _rec.get("content_group")
        lng = _rec.get("language")
        if not cg or not lng:
            continue
        key = (cg, lng)
        if key not in winners:
            winners[key] = _rec.get("episode_id", "")

    try:
        for slug, group in by_slug.items():
            # -- Derive show-level scalar values from the group. --
            first = group[0]
            title = first["show_title"]
            synopsis = first.get("synopsis")
            # Section: first non-null section value in the group.
            section_value = next(
                (g["section"] for g in group if g.get("section")),
                ShowSection.SERIES.value,
            )
            # Status: published if ANY row in the group is published.
            # Otherwise draft. Documented deterministic rule.
            status_value = (
                ShowStatus.PUBLISHED.value
                if any(g.get("status") == "published" for g in group)
                else ShowStatus.DRAFT.value
            )
            # Categories: union across the group, preserving first-seen order.
            categories: list[str] = []
            for g in group:
                for c in g.get("categories") or []:
                    if c not in categories:
                        categories.append(c)

            show = _get_or_create_show(
                db,
                slug=slug,
                title=title,
                synopsis=synopsis,
                section_value=section_value,
                status_value=status_value,
                categories=categories,
                result=result,
            )

            for rec in group:
                season_number = int(rec["season_number"])
                season = _get_or_create_season(
                    db,
                    show=show,
                    season_number=season_number,
                    result=result,
                )

                content_group = rec["content_group"]
                language = rec["language"]
                artwork_types = list(rec.get("artwork_available") or [])

                key = (content_group, language)
                source_id = rec.get("episode_id", "")

                # Source-driven collision rule: if this row is NOT the
                # first source row to claim (content_group, language),
                # it is a conflict. Deterministic regardless of DB
                # state and idempotent across reruns.
                if winners.get(key) and winners[key] != source_id:
                    result.episode_conflicts.append(
                        EpisodeConflict(
                            episode_id=source_id,
                            content_group=content_group,
                            language=language,
                            kept_episode_id=winners[key],
                            reason="duplicate_content_language",
                        )
                    )
                    continue

                # Idempotent refresh: the DB already has this episode
                # from a previous run. Not a conflict.
                already = db.execute(
                    select(Episode.id).where(
                        Episode.content_group == content_group,
                        Episode.language == language,
                    )
                ).scalar_one_or_none()
                if already is not None:
                    result.episodes_existing += 1
                    continue

                episode = _create_episode(
                    db,
                    season=season,
                    content_group=content_group,
                    language=language,
                    title=rec["episode_title"],
                    episode_number=int(rec["episode_number"]),
                    duration=rec.get("duration_seconds"),
                    status_value=rec.get("status", "draft"),
                    result=result,
                )
                _attach_artwork(
                    db,
                    episode=episode,
                    artwork_types=artwork_types,
                    result=result,
                )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return result


__all__ = ["EpisodeConflict", "SeedResult", "load_seed_shows"]
