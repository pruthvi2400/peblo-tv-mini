"""
Public catalogue endpoints (Phase 6).

These endpoints require NO authentication. They read from
the currently-published live catalogue stored under
catalogue/live.json in storage. They never touch the live
database directly: only the published JSON document.

  GET /catalog         -> the current catalogue
  GET /catalog/search  -> filtered show list (server-side)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas.catalog import empty_catalogue
from app.services.catalogue_reader import read_live_catalogue
from app.services.catalogue_search import search_catalogue


router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("", summary="Return the currently published catalogue.")
def get_catalog():
    return read_live_catalogue()


@router.get("/search", summary="Search the currently published catalogue.")
def search_catalog(
    q: Annotated[str | None, Query(max_length=255)] = None,
    category: Annotated[str | None, Query(max_length=64)] = None,
    language: Annotated[str | None, Query(max_length=10)] = None,
    section: Annotated[str | None, Query(max_length=32)] = None,
):
    catalogue = read_live_catalogue()
    results = search_catalogue(
        catalogue, q=q, category=category, language=language, section=section,
    )
    return {
        "query": {
            "q": q, "category": category,
            "language": language, "section": section,
        },
        "count": len(results),
        "results": results,
    }


__all__ = ["router"]
