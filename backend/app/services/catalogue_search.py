"""
Catalogue search (Phase 6).

Server-side in-memory search over the currently-published
catalogue. The browser NEVER downloads the whole catalogue
just to search -- the endpoint runs the filter server-side.

Filters compose with AND semantics:
  * q         case-insensitive substring match against show
              title, episode (canonical) title, and category.
  * category  exact match on a show category.
  * language  any published episode of the show has that lang.
  * section   exact match on a show section.

Results preserve the catalogue ordering (sections -> shows
by title/slug/id). Empty result set is `[]`.
"""

from __future__ import annotations

from typing import Any


def _show_languages(show: dict[str, Any]) -> set[str]:
    langs: set[str] = set();
    for season in show.get("seasons", []):
        for ep in season.get("episodes", []):
            langs.update(ep.get("languages", []))
    for tr in show.get("trailers", []):
        langs.update(tr.get("languages", []))
    return langs


def _show_matches_q(show: dict[str, Any], q_lower: str) -> bool:
    if q_lower in (show.get("title") or "").casefold():
        return True
    if any(q_lower in (c or "").casefold() for c in show.get("categories", [])):
        return True
    for season in show.get("seasons", []):
        for ep in season.get("episodes", []):
            if q_lower in (ep.get("title") or "").casefold():
                return True
    for tr in show.get("trailers", []):
        if q_lower in (tr.get("title") or "").casefold():
            return True
    return False


def search_catalogue(
    catalogue: dict[str, Any],
    *,
    q: str | None = None,
    category: str | None = None,
    language: str | None = None,
    section: str | None = None,
) -> list[dict[str, Any]]:
    """Filter `catalogue` and return a flat list of matching shows.

    Order: sections appear in catalogue order; within each
    section, shows appear in catalogue order.
    """
    q_lower = (q or "").strip().casefold()
    cat = (category or "").strip() or None
    lang = (language or "").strip() or None
    sec = (section or "").strip() or None

    out: list[dict[str, Any]] = []
    for sec_obj in catalogue.get("sections", []):
        sec_key = sec_obj.get("key")
        if sec and sec_key != sec:
            continue
        for show in sec_obj.get("shows", []):
            if cat and cat not in (show.get("categories") or []):
                continue
            if lang and lang not in _show_languages(show):
                continue
            if q_lower and not _show_matches_q(show, q_lower):
                continue
            out.append(show)
    return out


__all__ = ["search_catalogue"]
