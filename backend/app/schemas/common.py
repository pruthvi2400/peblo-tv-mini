"""
Common shared Pydantic schemas.

- PaginationParams: query parameters for list endpoints.
- MessageResponse: lightweight `{message: ...}` response body.
- ErrorResponse:   structured error envelope returned by routes / handlers.
"""

from typing import Annotated

from fastapi import Query
from pydantic import BaseModel, Field

from app.core.pagination import (
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)


# Reusable query-parameter alias for pagination.
# Annotated[..., Query(...)] lets FastAPI attach this schema to the
# `?page=&page_size=` query string with sensible bounds and docs.
PaginationParams = Annotated[
    "PaginationQuery",
    Query(...),
]


class PaginationQuery(BaseModel):
    """Pagination query parameters (page + page_size)."""

    page: int = Field(
        DEFAULT_PAGE,
        ge=1,
        description="1-based page number.",
    )
    page_size: int = Field(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE}).",
    )


class MessageResponse(BaseModel):
    """A simple `{message: ...}` body for 204-like or acknowledge responses."""

    message: str = Field(..., min_length=1, max_length=500)


class ErrorResponse(BaseModel):
    """
    Structured error envelope.

    Fields:
        detail: Human-readable error message.
        code:   Optional machine-readable error code (e.g. "duplicate_slug").
        field:  Optional dotted field path (e.g. "slug") when the error
                is tied to a specific input field.
    """

    detail: str = Field(..., min_length=1)
    code: str | None = Field(default=None, max_length=100)
    field: str | None = Field(default=None, max_length=200)