"""create core catalog tables

Revision ID: 06f851894ca7
Revises:
Create Date: 2026-09-05

Creates all core tables for the Peblo TV Mini catalog:
- users, shows, show_categories, seasons, episodes, artwork, publish_runs
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "06f851894ca7"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enum types (must exist before tables that reference them) ────────────
    op.execute("CREATE TYPE user_role AS ENUM ('editor', 'admin')")
    op.execute(
        "CREATE TYPE show_status AS ENUM ('draft', 'published', 'archived')"
    )
    op.execute(
        "CREATE TYPE show_section AS ENUM "
        "('featured', 'series', 'minisodes', 'songs')"
    )
    op.execute(
        "CREATE TYPE show_category AS ENUM ("
        "'adventure', 'folk', 'friendship', 'india', 'language', "
        "'learning', 'maths', 'music', 'nature', 'reading', "
        "'science', 'singalong', 'stories', 'travel', 'values')"
    )
    op.execute(
        "CREATE TYPE episode_status AS ENUM ('draft', 'published', 'removed')"
    )
    op.execute(
        "CREATE TYPE artwork_type AS ENUM ('poster', 'banner', 'thumbnail')"
    )
    op.execute(
        "CREATE TYPE publish_status AS ENUM ("
        "'pending', 'running', 'completed', 'failed', 'cancelled')"
    )

    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column(
            "role",
            postgresql.ENUM("editor", "admin", name="user_role",
                            create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    # ── shows ─────────────────────────────────────────────────────────────
    op.create_table(
        "shows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("synopsis", sa.Text(), nullable=True),
        sa.Column(
            "section",
            postgresql.ENUM("featured", "series", "minisodes", "songs",
                            name="show_section", create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "published", "archived",
                            name="show_status", create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_shows_id", "shows", ["id"], unique=False)
    op.create_index("ix_shows_title", "shows", ["title"], unique=False)
    op.create_index("ix_shows_slug", "shows", ["slug"], unique=True)
    op.create_index("ix_shows_section", "shows", ["section"], unique=False)
    op.create_index("ix_shows_status", "shows", ["status"], unique=False)

    # ── show_categories (join table) ───────────────────────────────────────
    op.create_table(
        "show_categories",
        sa.Column(
            "show_id", sa.Integer(), nullable=False, primary_key=True,
        ),
        sa.Column(
            "category",
            postgresql.ENUM(
                "adventure", "folk", "friendship", "india", "language",
                "learning", "maths", "music", "nature", "reading",
                "science", "singalong", "stories", "travel", "values",
                name="show_category", create_constraint=True
            ),
            nullable=False, primary_key=True,
        ),
        sa.ForeignKeyConstraint(["show_id"], ["shows.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_show_categories_show_id", "show_categories",
                    ["show_id"], unique=False)

    # ── seasons ───────────────────────────────────────────────────────────
    op.create_table(
        "seasons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("show_id", sa.Integer(), nullable=False),
        sa.Column("season_number", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("show_id", "season_number",
                            name="uq_season_show_number"),
        sa.ForeignKeyConstraint(["show_id"], ["shows.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_seasons_id", "seasons", ["id"], unique=False)
    op.create_index("ix_seasons_show_id", "seasons", ["show_id"], unique=False)

    # ── episodes ──────────────────────────────────────────────────────────
    op.create_table(
        "episodes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("season_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("language", sa.String(10), nullable=False),
        sa.Column("content_group", sa.String(255), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "published", "removed",
                            name="episode_status", create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("content_group", "language",
                            name="uq_episode_content_language"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_episodes_id", "episodes", ["id"], unique=False)
    op.create_index("ix_episodes_season_id", "episodes", ["season_id"],
                    unique=False)
    op.create_index("ix_episodes_title", "episodes", ["title"], unique=False)
    op.create_index("ix_episodes_language", "episodes", ["language"],
                    unique=False)
    op.create_index("ix_episodes_content_group", "episodes",
                    ["content_group"], unique=False)
    op.create_index("ix_episodes_status", "episodes", ["status"], unique=False)

    # ── artwork ───────────────────────────────────────────────────────────
    op.create_table(
        "artwork",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("episode_id", sa.Integer(), nullable=False),
        sa.Column(
            "artwork_type",
            postgresql.ENUM("poster", "banner", "thumbnail",
                            name="artwork_type", create_constraint=True),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(50), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("episode_id", "artwork_type",
                            name="uq_artwork_episode_type"),
        sa.ForeignKeyConstraint(["episode_id"], ["episodes.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_artwork_id", "artwork", ["id"], unique=False)
    op.create_index("ix_artwork_episode_id", "artwork", ["episode_id"],
                    unique=False)

    # ── publish_runs ──────────────────────────────────────────────────────
    op.create_table(
        "publish_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("triggered_by_user_id", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "running", "completed", "failed",
                            "cancelled", name="publish_status",
                            create_constraint=True),
            nullable=False,
        ),
        sa.Column("shows_count", sa.Integer(), nullable=True),
        sa.Column("seasons_count", sa.Integer(), nullable=True),
        sa.Column("episodes_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("error_details", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("now()"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["triggered_by_user_id"], ["users.id"],
                                ondelete="SET NULL"),
    )
    op.create_index("ix_publish_runs_id", "publish_runs", ["id"], unique=False)
    op.create_index("ix_publish_runs_triggered_by_user_id", "publish_runs",
                    ["triggered_by_user_id"], unique=False)
    op.create_index("ix_publish_runs_status", "publish_runs", ["status"],
                    unique=False)


def downgrade() -> None:
    op.drop_table("publish_runs")
    op.drop_table("artwork")
    op.drop_table("episodes")
    op.drop_table("seasons")
    op.drop_table("show_categories")
    op.drop_table("shows")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS publish_status")
    op.execute("DROP TYPE IF EXISTS artwork_type")
    op.execute("DROP TYPE IF EXISTS episode_status")
    op.execute("DROP TYPE IF EXISTS show_category")
    op.execute("DROP TYPE IF EXISTS show_section")
    op.execute("DROP TYPE IF EXISTS show_status")
    op.execute("DROP TYPE IF EXISTS user_role")
