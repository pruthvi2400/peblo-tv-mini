"""
Validation report (Phase 4 Part B).

Inspects the current database state and reports everything that would
block a publish.

Rules implemented (sourced from the Phase 3 service-layer invariants +
reference.json artwork_specs + seed_shows.json semantics):

  SHOW:
    * `missing_section`         published show without a section
    * `missing_categories`      published show with zero categories

  EPISODE:
    * `missing_duration`        published episode with NULL duration
    * `missing_artwork`         published episode without a required
                                 artwork type (poster + banner +
                                 thumbnail)

  DATA:
    * seed conflicts are NOT invented here; the seed loader records
      them on the `SeedResult.episode_conflicts` list but does not
      persist them. After the seed has loaded there is no in-DB state
      to inspect, so the report does not fabricate issues here. See
      the README + Phase 4 assumptions list.

The response shape is editor-friendly:

    {
      "can_publish": bool,
      "issues": [
          {
            "type":     str  (machine code, e.g. "missing_artwork"),
            "severity": "blocking",
            "entity":   "show" | "episode",
            "entity_id": int,
            "title":    str  (human label),
            "message":  str  (sentence describing the problem),
            "fields":   dict (machine-readable context)
          },
          ...
      ],
      "summary": {
        "blocking_issues": int,
        "by_type":         {code: count, ...},
        "shows_scanned":   int,
        "episodes_scanned": int
      }
    }

`can_publish` is `False` when at least one blocking issue exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.artwork import Artwork, ArtworkType
from app.models.episode import Episode, EpisodeStatus
from app.models.show import Show, ShowStatus


# Required artwork types for a published episode (all three).
_REQUIRED_ARTWORK_TYPES: tuple[ArtworkType, ...] = (
    ArtworkType.POSTER,
    ArtworkType.BANNER,
    ArtworkType.THUMBNAIL,
)


@dataclass
class Issue:
    """A single problem reported by the validator."""

    type: str
    severity: str       # "blocking" (Phase 4 only emits blocking)
    entity: str         # "show" | "episode"
    entity_id: int
    title: str
    message: str
    fields: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "severity": self.severity,
            "entity": self.entity,
            "entity_id": self.entity_id,
            "title": self.title,
            "message": self.message,
            "fields": self.fields,
        }


@dataclass
class ValidationReport:
    can_publish: bool
    issues: list[Issue] = field(default_factory=list)
    shows_scanned: int = 0
    episodes_scanned: int = 0

    def to_dict(self) -> dict[str, Any]:
        by_type: dict[str, int] = {}
        blocking = 0
        for issue in self.issues:
            by_type[issue.type] = by_type.get(issue.type, 0) + 1
            if issue.severity == "blocking":
                blocking += 1
        return {
            "can_publish": self.can_publish,
            "issues": [i.to_dict() for i in self.issues],
            "summary": {
                "blocking_issues": blocking,
                "by_type": by_type,
                "shows_scanned": self.shows_scanned,
                "episodes_scanned": self.episodes_scanned,
            },
        }


# ── Helpers ──────────────────────────────────────────────────────────────────


def _show_artwork_lookup(db: Session) -> dict[int, set[ArtworkType]]:
    """
    Return { episode_id -> set of artwork types } for every episode
    in the database. Built in one query to keep the report cheap.
    """
    rows = db.execute(
        select(Artwork.episode_id, Artwork.artwork_type)
    ).all()
    out: dict[int, set[ArtworkType]] = {}
    for ep_id, atype in rows:
        out.setdefault(ep_id, set()).add(atype)
    return out


def _published_episodes(db: Session) -> list[Episode]:
    return list(
        db.execute(
            select(Episode).where(Episode.status == EpisodeStatus.PUBLISHED)
        ).scalars().all()
    )


def _published_shows(db: Session) -> list[Show]:
    return list(
        db.execute(
            select(Show).where(Show.status == ShowStatus.PUBLISHED)
        ).scalars().all()
    )


# ── Public API ──────────────────────────────────────────────────────────────


def build_validation_report(db: Session) -> ValidationReport:
    """
    Scan the database and return a fresh `ValidationReport`. The
    report is read-only and never mutates state.
    """
    issues: list[Issue] = []

    # ── Shows ──────────────────────────────────────────────────────────────
    shows = _published_shows(db)
    for show in shows:
        if show.section is None:
            issues.append(
                Issue(
                    type="missing_section",
                    severity="blocking",
                    entity="show",
                    entity_id=show.id,
                    title=show.title,
                    message=(
                        f"Published show {show.title!r} (id={show.id}) "
                        f"has no section. Please assign it to one of: "
                        f"featured, series, minisodes, songs."
                    ),
                    fields={"slug": show.slug},
                )
            )
        if not show.categories:
            issues.append(
                Issue(
                    type="missing_categories",
                    severity="blocking",
                    entity="show",
                    entity_id=show.id,
                    title=show.title,
                    message=(
                        f"Published show {show.title!r} (id={show.id}) "
                        f"has no categories. Please add at least one."
                    ),
                    fields={"slug": show.slug},
                )
            )

    # ── Episodes ──────────────────────────────────────────────────────────
    artwork_by_episode = _show_artwork_lookup(db)
    episodes = _published_episodes(db)

    for episode in episodes:
        # Title for the message: include content_group so editors can
        # tell language variants apart.
        ep_title = (
            f"{episode.title} ({episode.content_group}, "
            f"{episode.language})"
        )
        if episode.duration is None or episode.duration <= 0:
            issues.append(
                Issue(
                    type="missing_duration",
                    severity="blocking",
                    entity="episode",
                    entity_id=episode.id,
                    title=ep_title,
                    message=(
                        f"Published episode {ep_title!r} (id={episode.id}) "
                        f"is missing a duration. Please set a positive "
                        f"duration before publishing."
                    ),
                    fields={
                        "content_group": episode.content_group,
                        "language": episode.language,
                    },
                )
            )

        have = artwork_by_episode.get(episode.id, set())
        missing = [t for t in _REQUIRED_ARTWORK_TYPES if t not in have]
        if missing:
            missing_labels = [t.value for t in missing]
            issues.append(
                Issue(
                    type="missing_artwork",
                    severity="blocking",
                    entity="episode",
                    entity_id=episode.id,
                    title=ep_title,
                    message=(
                        f"Published episode {ep_title!r} (id={episode.id}) "
                        f"is missing required artwork: {missing_labels}. "
                        f"Please upload poster, banner, and thumbnail "
                        f"before publishing."
                    ),
                    fields={
                        "content_group": episode.content_group,
                        "language": episode.language,
                        "missing_types": missing_labels,
                    },
                )
            )

    report = ValidationReport(
        can_publish=not any(i.severity == "blocking" for i in issues),
        issues=issues,
        shows_scanned=len(shows),
        episodes_scanned=len(episodes),
    )
    return report


__all__ = [
    "Issue",
    "ValidationReport",
    "build_validation_report",
]