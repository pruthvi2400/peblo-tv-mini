"""
Pydantic schemas for the published catalogue (Phase 6).

Design notes:

* Frozen on object storage by POST /admin/catalog/publish.
* Sections: featured, series, minisodes, songs.
* content_group collapses into ONE episode with languages list.
* Season 0 -> show.trailers (never in show.seasons).
* artwork contains ONLY types that actually exist.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ArtworkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str
    url: str
    width: int | None = None
    height: int | None = None
    mime_type: str | None = None


class EpisodeArtwork(BaseModel):
    model_config = ConfigDict(extra="forbid")
    poster: ArtworkItem | None = None
    banner: ArtworkItem | None = None
    thumbnail: ArtworkItem | None = None

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class CatalogEpisode(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_group: str
    languages: list[str] = Field(min_length=1)
    canonical_language: str
    title: str
    episode_number: int = Field(ge=0)
    duration: int | None = Field(default=None, ge=0)
    artwork: dict[str, ArtworkItem] = Field(default_factory=dict)


class CatalogTrailer(CatalogEpisode):
    model_config = ConfigDict(extra="forbid")


class CatalogSeason(BaseModel):
    model_config = ConfigDict(extra="forbid")
    season_number: int = Field(ge=1)
    episodes: list[CatalogEpisode]


class CatalogShow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int = Field(ge=1)
    slug: str
    title: str
    synopsis: str | None = None
    section: str
    categories: list[str] = Field(default_factory=list)
    trailers: list[CatalogTrailer] = Field(default_factory=list)
    seasons: list[CatalogSeason] = Field(default_factory=list)


class CatalogSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str
    shows: list[CatalogShow] = Field(default_factory=list)


class Catalog(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = 1
    published_at: datetime
    publish_run_id: int | None = None
    sections: list[CatalogSection] = Field(default_factory=list)


def empty_catalogue() -> dict[str, Any]:
    return {
        "version": 1,
        "published_at": None,
        "publish_run_id": None,
        "sections": [],
    }


__all__ = [
    "ArtworkItem", "Catalog", "CatalogEpisode",
    "CatalogSection", "CatalogSeason", "CatalogShow",
    "CatalogTrailer", "EpisodeArtwork", "empty_catalogue",
]
