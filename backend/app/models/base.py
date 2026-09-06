"""
Base mixins for SQLAlchemy models.

Provides common column definitions used across all models.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """
    Mixin that adds created_at and updated_at timestamp columns.

    Uses timezone-aware UTC timestamps (TIMESTAMP WITH TIME ZONE in PostgreSQL).
    - created_at: automatically set on insert, never modified afterwards.
    - updated_at: automatically set on insert, updated on every UPDATE.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="UTC timestamp when the record was created.",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="UTC timestamp when the record was last modified.",
    )
