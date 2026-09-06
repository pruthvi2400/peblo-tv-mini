"""
Episode model for TV show episodes.
"""

import enum

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class EpisodeStatus(str, enum.Enum):
    """
    Availability status of an episode.
    Values sourced from seed_shows.json (status field uses "published", "draft").

    - draft: not yet available to viewers.
    - published: published and accessible on the platform.
    - removed: no longer accessible but data is retained.
    """

    DRAFT = "draft"
    PUBLISHED = "published"
    REMOVED = "removed"


class Episode(TimestampMixin, Base):
    """
    An individual episode within a season.

    Attributes:
        id: Primary key.
        season_id: FK to the parent season.
        title: Display title of the episode.
        episode_number: Ordinal number within the season.
        duration: Video duration in seconds.
        language: ISO 639-1 language code ('en' or 'hi' per reference.json).
        content_group: Logical grouping identifier for the episode asset.
            Used in the unique constraint with language.
        status: Availability status.
        created_at: When the episode was created.
        updated_at: When the episode was last modified.

    Key observations from seed_shows.json:
        - Episodes do NOT have a description field. The show's synopsis
          is shared by all episodes (seed_shows.json shows episodes repeating
          the same show-level synopsis, not episode-specific descriptions).
        - duration_seconds is always present in seed data (always provided).
        - content_group + language must be unique across all episodes.
          This enforces the reference.json convention that episodes sharing
          a content_group are language variants that collapse into ONE
          catalogue entry.
        - episode_number is unique within a season (enforced by the data model).

    Constraints:
        - (content_group, language) must be unique.
    """

    __tablename__ = "episodes"
    __table_args__ = (
        UniqueConstraint(
            "content_group",
            "language",
            name="uq_episode_content_language",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    season_id: Mapped[int] = mapped_column(
        ForeignKey("seasons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="FK to the parent season.",
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Display title of the episode.",
    )

    episode_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        doc="Ordinal number within the season.",
    )

    duration: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,  # Nullable: trailer episodes may not have duration
        doc="Video duration in seconds. NULL for trailers or if unknown.",
    )

    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        index=True,
        doc="ISO 639-1 language code ('en' or 'hi' per reference.json).",
    )

    content_group: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc=(
            "Logical content group identifier for the episode asset. "
            "Unique with language across all episodes. "
            "Reference: episodes sharing a content_group are language "
            "variants that collapse into ONE catalogue entry."
        ),
    )

    status: Mapped[EpisodeStatus] = mapped_column(
        SAEnum(EpisodeStatus, name="episode_status", create_constraint=True),
        nullable=False,
        default=EpisodeStatus.DRAFT,
        index=True,
        doc="Availability status (draft/published/removed).",
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    season: Mapped["Season"] = relationship(
        back_populates="episodes",
        doc="The parent season this episode belongs to.",
    )

    artwork: Mapped[list["Artwork"]] = relationship(
        back_populates="episode",
        cascade="all, delete-orphan",
        doc="Artwork assets for this episode.",
    )

    def __repr__(self) -> str:
        return (
            f"<Episode(id={self.id}, title={self.title!r}, "
            f"language={self.language!r}, status={self.status})>"
        )
