"""
Catalogue builder (Phase 6).

Builds the published catalogue document from the current DB.
Output is deterministic: same DB state -> same catalogue; same
inputs -> same ordering. The publisher freezes this output on
object storage via the Storage abstraction.

Rules (enforced here, never at the route layer):
  1. Only published shows + published episodes.
  2. content_group collapses to ONE episode whose languages list
     enumerates every published variant. Canonical variant:
       a) language == "en" when present;
       b) else lexicographically smallest language code.
  3. Season 0 -> show.trailers. NEVER inside show.seasons.
  4. Section order: featured, series, minisodes, songs.
  5. Within section: shows by (title, slug, id).
     Within show: seasons by season_number; episodes by
     (episode_number, content_group).
  6. Artwork: ONLY types that ACTUALLY exist on the canonical
     variant. URLs via Storage.get_url.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import SECTIONS
from app.models.episode import Episode, EpisodeStatus
from app.models.season import Season
from app.models.show import Show, ShowStatus
def _canonical_language(variants: list[Episode]) -> Episode:
    """Pick the canonical variant for a (content_group) language
    collapse. The rule is:
      1. Prefer language == "en" when present.
      2. Otherwise the lexicographically smallest language code.

    `variants` is expected to be non-empty.
    """
    for ep in variants:
        if ep.language == "en":
            return ep
    return sorted(variants, key=lambda e: e.language)[0]


def _artwork_for_episode(
    ep: Episode,
    *,
    storage: Storage,
) -> dict[str, dict[str, Any]]:
    """Return {type -> {type, url, width, height, mime_type}} for
    every Artwork row on `ep`. Only types that actually exist
    are included.
    """
    out: dict[str, dict[str, Any]] = {}
    for art in ep.artwork:
        try:
            url = storage.get_url(art.storage_key)
        except Exception:
            logger.warning(
                "Skipping artwork id=%s for episode id=%s: bad storage_key.",
                art.id,
                ep.id,
            )
            continue
        out[art.artwork_type.value] = {
            "type": art.artwork_type.value,
            "url": url,
            "width": art.width,
            "height": art.height,
            "mime_type": art.mime_type,
        }
    return out
from app.services.storage import Storage, get_storage


logger = logging.getLogger(__name__)


_SECTION_ORDER: tuple[str, ...] = tuple(SECTIONS)
def _build_seasons_and_trailers(
    episodes: list[Episode],
    *,
    storage: Storage,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split a show's published episodes into (regular_seasons,
    trailers). `season_number == 0` is routed to trailers; every
    other season goes into regular_seasons.

    Within each list we collapse language variants per
    content_group and select the canonical variant.
    """
    by_season_number: dict[int, list[Episode]] = defaultdict(list)
    for ep in episodes:
        by_season_number[ep.season.season_number].append(ep)

    regular_seasons: list[dict[str, Any]] = []
    trailers: list[dict[str, Any]] = []

    for season_number in sorted(by_season_number):
        season_eps = by_season_number[season_number]
        by_cg: dict[str, list[Episode]] = defaultdict(list)
        for ep in season_eps:
            by_cg[ep.content_group].append(ep)

        cat_episodes: list[dict[str, Any]] = []
        for content_group in sorted(by_cg):
            variants = by_cg[content_group]
            langs = sorted({v.language for v in variants})
            canonical = _canonical_language(variants)
            cat_episodes.append(
                {
                    "content_group": content_group,
                    "languages": langs,
                    "canonical_language": canonical.language,
                    "title": canonical.title,
                    "episode_number": canonical.episode_number,
                    "duration": canonical.duration,
                    "artwork": _artwork_for_episode(
                        canonical, storage=storage
                    ),
                }
            )
        cat_episodes.sort(
            key=lambda e: (e["episode_number"], e["content_group"])
        )

        if season_number == 0:
            trailers.extend(
                {
                    "content_group": e["content_group"],
                    "languages": e["languages"],
                    "canonical_language": e["canonical_language"],
                    "title": e["title"],
                    "episode_number": e["episode_number"],
                    "duration": e["duration"],
                    "artwork": e["artwork"],
                }
                for e in cat_episodes
            )
        else:
            regular_seasons.append(
                {
                    "season_number": season_number,
                    "episodes": cat_episodes,
                }
            )

    return regular_seasons, trailers


def _load_published_shows(db: Session) -> list[Show]:
    return list(
        db.execute(
            select(Show).where(Show.status == ShowStatus.PUBLISHED)
        ).scalars().all()
    )


def _load_published_episodes(db: Session) -> list[Episode]:
    return list(
        db.execute(
            select(Episode)
            .where(Episode.status == EpisodeStatus.PUBLISHED)
            .join(Season, Episode.season_id == Season.id)
            .join(Show, Season.show_id == Show.id)
            .where(Show.status == ShowStatus.PUBLISHED)
        ).scalars().all()
    )


def build_catalogue(
    db: Session,
    *,
    published_at: datetime,
    publish_run_id: int | None,
    storage: Storage | None = None,
) -> dict[str, Any]:
    """Build the full catalogue document from `db`.

    Args:
        db: An open SQLAlchemy session bound to the live DB.
        published_at: Timestamp to stamp onto the envelope.
        publish_run_id: PublishRun row id (None for empty builds).
        storage: Storage backend for resolving artwork URLs.
                 Defaults to `get_storage()`.

    Returns:
        A JSON-serialisable dict matching `Catalog`.

    Determinism:
        * Sections appear in `_SECTION_ORDER`.
        * Within a section: shows by (title, slug, id).
        * Within a show: seasons by season_number; episodes by
          (episode_number, content_group).
        * Within a content_group: languages sorted lexicographically.
        * Canonical language is "en" if present, else lex-min.
    """
    if storage is None:
        storage = get_storage()

    shows = _load_published_shows(db)
    episodes = _load_published_episodes(db)

    episodes_by_show: dict[int, list[Episode]] = defaultdict(list)
    for ep in episodes:
        episodes_by_show[ep.season.show_id].append(ep)

    shows_by_section: dict[str, list[dict[str, Any]]] = {
        key: [] for key in _SECTION_ORDER
    }

    shows_sorted = sorted(
        shows, key=lambda s: (s.title.casefold(), s.slug, s.id)
    )

    for show in shows_sorted:
        section_key = show.section.value if show.section else None
        if section_key not in shows_by_section:
            continue

        show_eps = episodes_by_show.get(show.id, [])
        regular_seasons, trailers = _build_seasons_and_trailers(
            show_eps, storage=storage
        )
        trailers.sort(
            key=lambda e: (e["episode_number"], e["content_group"])
        )

        shows_by_section[section_key].append(
            {
                "id": show.id,
                "slug": show.slug,
                "title": show.title,
                "synopsis": show.synopsis,
                "section": section_key,
                "categories": sorted(c.value for c in show.categories),
                "trailers": trailers,
                "seasons": regular_seasons,
            }
        )

    sections = [
        {"key": key, "shows": shows_by_section[key]}
        for key in _SECTION_ORDER
    ]

    return {
        "version": 1,
        "published_at": published_at.isoformat(),
        "publish_run_id": publish_run_id,
        "sections": sections,
    }


__all__ = ["build_catalogue"]