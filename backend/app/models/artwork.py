"""
Artwork model for episode thumbnail/banner images.
"""

import enum

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class ArtworkType(str, enum.Enum):
    """
    Type of artwork asset.
    Values sourced from reference.json artwork_specs keys and seed_shows.json
    artwork_available field.

    - poster: 2:3 aspect ratio, target 600x900px.
    - banner: 16:9 aspect ratio, target 1280x720px.
    - thumbnail: 16:9 aspect ratio, target 640x360px.
    """

    POSTER = "poster"
    BANNER = "banner"
    THUMBNAIL = "thumbnail"


class Artwork(TimestampMixin, Base):
    """
    Image asset associated with an episode.

    Artwork belongs to an episode. Multiple artwork types can be
    stored for the same episode (e.g. poster + banner + thumbnail).

    Attributes:
        id: Primary key.
        episode_id: FK to the parent episode.
        artwork_type: Semantic type of the artwork (poster/banner/thumbnail).
        storage_key: Object-storage path/key (e.g. S3 key or local path).
        width: Image width in pixels.
        height: Image height in pixels.
        size_bytes: File size in bytes.
        mime_type: MIME type of the image (e.g. 'image/jpeg', 'image/webp').
        created_at: When the artwork record was created.
        updated_at: When the artwork record was last modified.

    Observations from reference.json / seed_shows.json:
        - Artwork types are exactly: poster, banner, thumbnail (3 types).
        - seed_shows.json shows artwork_available as an array per episode.
        - Actual image upload/storage is not in scope for this phase;
          only the metadata record is stored here.

    Constraints:
        - (episode_id, artwork_type) must be unique — an episode cannot
          have two assets of the same type.
    """

    __tablename__ = "artwork"
    __table_args__ = (
        UniqueConstraint(
            "episode_id",
            "artwork_type",
            name="uq_artwork_episode_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    episode_id: Mapped[int] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="FK to the parent episode.",
    )

    artwork_type: Mapped[ArtworkType] = mapped_column(
        SAEnum(ArtworkType, name="artwork_type", create_constraint=True),
        nullable=False,
        doc="Semantic type of the artwork (poster/banner/thumbnail).",
    )

    storage_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Object-storage key/path where the file is stored.",
    )

    width: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Image width in pixels.",
    )

    height: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Image height in pixels.",
    )

    size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="File size in bytes.",
    )

    mime_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="image/jpeg",
        doc="MIME type of the image (e.g. 'image/jpeg', 'image/webp').",
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    episode: Mapped["Episode"] = relationship(
        back_populates="artwork",
        doc="The parent episode this artwork belongs to.",
    )

    def __repr__(self) -> str:
        return (
            f"<Artwork(id={self.id}, episode_id={self.episode_id}, "
            f"type={self.artwork_type}, storage_key={self.storage_key!r})>"
        )
