"""
Pagination helpers used by API list endpoints.

Pagination uses 1-based page numbers with a configurable page size.
A `page` parameter below 1 is coerced to 1 and `page_size` is capped at
`MAX_PAGE_SIZE` to avoid expensive unbounded queries.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

# ─── Limits ───────────────────────────────────────────────────────────────────
DEFAULT_PAGE: int = 1
DEFAULT_PAGE_SIZE: int = 20
MAX_PAGE_SIZE: int = 100


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """
    Generic paginated response envelope.

    Attributes:
        items: The page's rows.
        page: 1-based page number actually returned.
        page_size: Number of items returned in this page.
        total: Total number of rows matching the query (across all pages).
    """

    items: list[T] = Field(default_factory=list)
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    total: int = Field(..., ge=0)


def clamp_page(value: int | None) -> int:
    """Return a safe page number (>=1). None or <1 maps to 1."""
    if value is None or value < 1:
        return DEFAULT_PAGE
    return value


def clamp_page_size(value: int | None) -> int:
    """Return a safe page size in [1, MAX_PAGE_SIZE]."""
    if value is None or value < 1:
        return DEFAULT_PAGE_SIZE
    return min(value, MAX_PAGE_SIZE)


def offset_for(page: int, page_size: int) -> int:
    """Compute the SQL OFFSET for a (page, page_size) pair."""
    return (page - 1) * page_size