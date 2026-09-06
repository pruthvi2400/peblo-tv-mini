"""allow shows.section to be nullable

Revision ID: a1b2c3d4e5f6
Revises: 06f851894ca7
Create Date: 2026-09-05

Phase 4: the validation-report endpoint needs to be able to surface
published shows that were inserted without a section (e.g. by a
direct DB migration or admin script that bypassed the API). The API
itself still requires a section via the Pydantic schema.

This migration drops the NOT NULL constraint on shows.section so the
validator has something to detect.
"""

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "06f851894ca7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "shows",
        "section",
        existing_type=sa.Enum(
            "featured", "series", "minisodes", "songs",
            name="show_section",
        ),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "shows",
        "section",
        existing_type=sa.Enum(
            "featured", "series", "minisodes", "songs",
            name="show_section",
        ),
        nullable=False,
    )