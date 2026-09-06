"""
PublishRun model for tracking publishing operations.
"""

import enum
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class PublishStatus(str, enum.Enum):
    """
    Status of a publish run.

    - pending: publish has been triggered but not yet started.
    - running: publish is currently in progress.
    - completed: publish finished successfully.
    - failed: publish encountered an error.
    - cancelled: publish was manually cancelled.
    """

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PublishRun(TimestampMixin, Base):
    """
    A publishing operation/job for catalog content.

    Tracks the history of publish operations including counts of
    shows, seasons, and episodes published, plus any error details.

    Attributes:
        id: Primary key.
        triggered_by_user_id: FK to the user who initiated the publish.
        started_at: When the publish operation began (UTC).
        completed_at: When the publish operation finished (NULL if pending/running).
        status: Current status of the publish run.
        shows_count: Number of shows included in this publish.
        seasons_count: Number of seasons included in this publish.
        episodes_count: Number of episodes included in this publish.
        error_message: Short error message if the publish failed (NULL otherwise).
        error_details: Full stack trace or additional error context (nullable).
        created_at: When the publish run record was created.
        updated_at: When the record was last modified.

    Notes:
        - started_at / completed_at are kept as explicit columns alongside
          the TimestampMixin timestamps for clarity in tracking job timing.
        - The actual publishing logic (manifest generation, CDN push, etc.)
          is handled by a separate service — this model only tracks the operation.
        - Counts reflect what was included in the publish batch at start time.
    """

    __tablename__ = "publish_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    triggered_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="FK to the user who triggered this publish. NULL if system-triggered.",
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="UTC timestamp when the publish operation began.",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="UTC timestamp when the publish completed (NULL if still running).",
    )

    status: Mapped[PublishStatus] = mapped_column(
        SAEnum(PublishStatus, name="publish_status", create_constraint=True),
        nullable=False,
        default=PublishStatus.PENDING,
        index=True,
        doc="Current status of the publish run.",
    )

    shows_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=0,
        doc="Number of shows included in this publish.",
    )

    seasons_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=0,
        doc="Number of seasons included in this publish.",
    )

    episodes_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=0,
        doc="Number of episodes included in this publish.",
    )

    error_message: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        doc="Short human-readable error message if publish failed.",
    )

    error_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Full error stack trace or additional context (may be JSON).",
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    triggered_by_user: Mapped["User | None"] = relationship(
        back_populates="publish_runs",
        doc="The user who triggered this publish run.",
    )

    def __repr__(self) -> str:
        return (
            f"<PublishRun(id={self.id}, status={self.status}, "
            f"episodes_count={self.episodes_count})>"
        )
