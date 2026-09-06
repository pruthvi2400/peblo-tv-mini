"""
Show model for TV series and content catalog.
"""

import enum

from sqlalchemy import String, Text, Enum as SAEnum, Table, Column, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class ShowStatus(str, enum.Enum):
    """
    Publishing status of a show.

    - draft: visible only in the admin panel, not published.
    - published: visible on the Peblo TV platform.
    - archived: no longer visible but retained for historical data.
    """

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ShowSection(str, enum.Enum):
    """
    Platform section where the show appears.
    Values sourced from reference.json sections.
    """

    FEATURED = "featured"
    SERIES = "series"
    MINISODES = "minisodes"
    SONGS = "songs"


class ShowCategory(str, enum.Enum):
    """
    Content category for a show.
    Values sourced from reference.json categories.
    A show can belong to multiple categories (many-to-many via show_categories).
    """

    ADVENTURE = "adventure"
    FOLK = "folk"
    FRIENDSHIP = "friendship"
    INDIA = "india"
    LANGUAGE = "language"
    LEARNING = "learning"
    MATHS = "maths"
    MUSIC = "music"
    NATURE = "nature"
    READING = "reading"
    SCIENCE = "science"
    SINGALONG = "singalong"
    STORIES = "stories"
    TRAVEL = "travel"
    VALUES = "values"


class Show(TimestampMixin, Base):
    """
    A TV show / series in the Peblo TV catalog.

    Attributes:
        id: Primary key.
        title: Display name of the show.
        slug: URL-friendly, globally unique identifier.
        synopsis: Long-form description. Shared by all episodes in the show
            (per seed_shows.json convention — episodes don't have their own descriptions).
        section: Platform placement section (featured/series/minisodes/songs).
        status: Draft, published, or archived.
        created_at: When the show was created.
        updated_at: When the show was last modified.

    Relationships:
        categories: Many-to-many with ShowCategory via show_categories join table.
        seasons: One-to-many with Season.

    Conventions from reference.json / seed_shows.json:
        - slug is unique and used for URL-friendly identification.
        - synopsis is shared across all episodes of the show.
        - A show can have multiple categories (stored in the join table).
        - Season 0 is reserved for trailers (enforced at Season model level).
    """

    __tablename__ = "shows"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Display title of the show.",
    )

    slug: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        doc="URL-friendly, globally unique identifier (e.g. 'motis-many-lives').",
    )

    synopsis: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc=(
            "Long-form description of the show. "
            "Shared by all episodes in the show (per seed_shows.json convention)."
        ),
    )

    section: Mapped[ShowSection | None] = mapped_column(
        SAEnum(ShowSection, name="show_section", create_constraint=True),
        nullable=True,
        index=True,
        doc=(
            "Platform section placement. Nullable at the DB layer so "
            "the validation-report endpoint can surface published shows "
            "that were inserted without a section. The API still requires "
            "a section on create/update via the Pydantic schema."
        ),
    )

    status: Mapped[ShowStatus] = mapped_column(
        SAEnum(ShowStatus, name="show_status", create_constraint=True),
        nullable=False,
        default=ShowStatus.DRAFT,
        index=True,
        doc="Publishing status.",
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    # Many-to-many with ShowCategory enum values stored in the
    # `show_categories` association table.
    #
    # ShowCategory is a Python enum (not a SQLAlchemy mapped model), so we
    # cannot define a regular `relationship` against it — SQLAlchemy tries
    # to resolve the target as a mapped class and fails on backends that
    # don't auto-resolve enum names.
    #
    # Instead, we expose the enum values directly via an
    # `association_proxy` over the join-table rows. Reads return
    # ShowCategory enum members; writes accept enum members or plain
    # strings (which are coerced to enum members in `_set_categories`).
    _category_rows: Mapped[list["_ShowCategoryRow"]] = relationship(
        "_ShowCategoryRow",
        primaryjoin="Show.id == _ShowCategoryRow.show_id",
        cascade="all, delete-orphan",
        doc="Internal: rows of the show_categories join table.",
    )

    @property
    def categories(self) -> list["ShowCategory"]:
        """Read categories as ShowCategory enum members."""
        return [ShowCategory(row.category) for row in self._category_rows]

    @categories.setter
    def categories(self, values) -> None:
        """Replace categories with the given iterable of strings/enums."""
        # `_ShowCategoryRow` is defined further down in this module; it's
        # safe to reference here because the class only needs to exist
        # by the time this setter is *called*, not at class-define time.
        self._category_rows[:] = [
            _ShowCategoryRow(category=_coerce_category(v))
            for v in (values or [])
        ]

    seasons: Mapped[list["Season"]] = relationship(
        back_populates="show",
        cascade="all, delete-orphan",
        order_by="Season.season_number",
        doc="All seasons belonging to this show.",
    )

    def __repr__(self) -> str:
        return (
            f"<Show(id={self.id}, title={self.title!r}, slug={self.slug!r}, "
            f"status={self.status})>"
        )


# ─── Association Table: Show <-> ShowCategory (Many-to-Many) ─────────────────
# reference.json specifies that a show can have multiple categories.
# The join table uses the enum name as the column type.
#
# This class is mapped (rather than a plain Table) so the Show model can
# have a regular `relationship` against it without SQLAlchemy trying to
# resolve `ShowCategory` (an enum, not a mapped class) as the target.
# The DB schema (columns `show_id`, `category`) is unchanged so the
# existing Alembic migration still applies cleanly.

class _ShowCategoryRow(Base):
    """Join-table row mapping a show to a category enum value."""

    __tablename__ = "show_categories"

    show_id: Mapped[int] = mapped_column(
        ForeignKey("shows.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category: Mapped[ShowCategory] = mapped_column(
        SAEnum(ShowCategory, name="show_category", create_constraint=True),
        primary_key=True,
    )


# Backwards-compatible alias: the Phase 2 migration and
# `app.models.__init__` reference this name.
show_categories = _ShowCategoryRow.__table__


def _coerce_category(value) -> ShowCategory:
    """Coerce a string or enum into a ShowCategory enum member."""
    if isinstance(value, ShowCategory):
        return value
    return ShowCategory(value)
