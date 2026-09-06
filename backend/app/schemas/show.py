"""
Show CRUD schemas.

- ShowCreate: payload for POST /api/shows
- ShowUpdate: payload for PUT /api/shows/{id}
- ShowRead:   response shape for show resources

Validation notes:
- `slug` is required and must be a URL-safe kebab-case identifier.
  Slug uniqueness is enforced at the service layer (not at Pydantic
  level) so we can return 409 Conflict with a clear message.
- `section` is required and must be one of SECTIONS.
- `categories` is a non-empty subset of CATEGORIES.
- The published-state business rule (`status == "published"` requires
  `section`) is checked at the service layer.
"""

import re as _re
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.core.enums import (
    CATEGORIES,
    CATEGORY_SET,
    SECTION_SET,
)
from app.models.show import ShowSection, ShowStatus


_SLUG_PATTERN = _re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class _ShowBase(BaseModel):
    """Fields shared by ShowCreate / ShowUpdate."""

    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    synopsis: str | None = None
    section: ShowSection
    status: ShowStatus = Field(default=ShowStatus.DRAFT)
    categories: list[str] = Field(default_factory=list)

    @field_validator("slug")
    @classmethod
    def _slug_format(cls, v: str) -> str:
        if not _SLUG_PATTERN.match(v):
            raise ValueError(
                "slug must be lowercase letters, digits, and dashes only "
                "(no leading/trailing dash, no consecutive dashes)."
            )
        return v

    @field_validator("section")
    @classmethod
    def _section_value(cls, v: ShowSection) -> ShowSection:
        if v.value not in SECTION_SET:
            raise ValueError(
                f"section must be one of {sorted(SECTION_SET)}"
            )
        return v

    @field_validator("categories")
    @classmethod
    def _categories_values(cls, v: list[str]) -> list[str]:
        if not v:
            return v
        seen: list[str] = []
        for c in v:
            if c not in CATEGORY_SET:
                raise ValueError(
                    f"category {c!r} is not valid; must be one of "
                    f"{sorted(CATEGORY_SET)}"
                )
            if c not in seen:
                seen.append(c)
        return seen

    @model_validator(mode="after")
    def _published_requires_section(self) -> "_ShowBase":
        if self.status == ShowStatus.PUBLISHED and self.section is None:
            raise ValueError(
                "A show with status='published' must have a section."
            )
        return self


class ShowCreate(_ShowBase):
    """Payload for creating a show."""


class ShowUpdate(BaseModel):
    """Payload for updating a show (partial updates supported)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=255)
    synopsis: str | None = None
    section: ShowSection | None = None
    status: ShowStatus | None = None
    categories: list[str] | None = None

    @field_validator("slug")
    @classmethod
    def _slug_format(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _SLUG_PATTERN.match(v):
            raise ValueError(
                "slug must be lowercase letters, digits, and dashes only "
                "(no leading/trailing dash, no consecutive dashes)."
            )
        return v

    @field_validator("section")
    @classmethod
    def _section_value(cls, v: ShowSection | None) -> ShowSection | None:
        if v is None:
            return v
        if v.value not in SECTION_SET:
            raise ValueError(
                f"section must be one of {sorted(SECTION_SET)}"
            )
        return v

    @field_validator("categories")
    @classmethod
    def _categories_values(
        cls, v: list[str] | None
    ) -> list[str] | None:
        if v is None:
            return v
        seen: list[str] = []
        for c in v:
            if c not in CATEGORY_SET:
                raise ValueError(
                    f"category {c!r} is not valid; must be one of "
                    f"{sorted(CATEGORY_SET)}"
                )
            if c not in seen:
                seen.append(c)
        return seen


class ShowRead(BaseModel):
    """Show resource returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    synopsis: str | None
    section: ShowSection
    status: ShowStatus
    categories: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _serialize_categories(cls, data):
        """
        `Show.categories` is a SQLAlchemy relationship that returns
        ShowCategory enum objects. Convert them to plain strings for the API.
        """
        if hasattr(data, "categories"):
            return {
                "id": getattr(data, "id", None),
                "title": getattr(data, "title", None),
                "slug": getattr(data, "slug", None),
                "synopsis": getattr(data, "synopsis", None),
                "section": getattr(data, "section", None),
                "status": getattr(data, "status", None),
                "categories": [
                    c.value if hasattr(c, "value") else str(c)
                    for c in data.categories
                ],
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
            }
        return data


__all__ = [
    "CATEGORIES",
    "ShowCreate",
    "ShowRead",
    "ShowUpdate",
]