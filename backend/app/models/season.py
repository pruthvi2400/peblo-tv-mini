"""
Season model for TV show seasons.
"""

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class Season(TimestampMixin, Base):
    """
    A season belonging to a TV show.

    Season 0 is reserved for trailers associated with a show
    (per reference.json convention).

    Attributes:
        id: Primary key.
        show_id: Foreign key to the parent show.
        season_number: Ordinal season number (0 = trailers, 1 = first season).
        created_at: When the season was created.
        updated_at: When the season was last modified.

    Constraints:
        - (show_id, season_number) must be unique within a show.
    """

    __tablename__ = "seasons"
    __table_args__ = (
        UniqueConstraint(
            "show_id",
            "season_number",
            name="uq_season_show_number",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    show_id: Mapped[int] = mapped_column(
        ForeignKey("shows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="FK to the parent show.",
    )

    season_number: Mapped[int] = mapped_column(
        nullable=False,
        default=1,
        doc=(
            "Season ordinal. "
            "0 = trailers, 1 = first season, etc. "
            "Must be unique within a show."
        ),
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    show: Mapped["Show"] = relationship(
        back_populates="seasons",
        doc="The parent show this season belongs to.",
    )

    episodes: Mapped[list["Episode"]] = relationship(
        back_populates="season",
        cascade="all, delete-orphan",
        order_by="Episode.episode_number",
        doc="All episodes in this season.",
    )

    def __repr__(self) -> str:
        return f"<Season(id={self.id}, show_id={self.show_id}, season_number={self.season_number})>"
