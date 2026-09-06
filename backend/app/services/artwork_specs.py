"""
Artwork validation specs -- single source of truth for Phase 4.

Values here mirror `reference.json -> artwork_specs` exactly:

    poster:     2:3, 600 x 900,  <= 200 KB
    banner:    16:9, 1280 x 720, <= 200 KB
    thumbnail: 16:9, 640 x 360,  <= 200 KB

We deliberately re-declare the numbers here (instead of reading
`reference.json` at runtime) so the validator has no I/O cost and so
test assertions are deterministic. If the JSON changes the update is a
single-file edit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from app.models.artwork import ArtworkType


@dataclass(frozen=True)
class ArtworkSpec:
    """Image requirements for a single artwork type."""

    artwork_type: ArtworkType
    aspect_w: int       # e.g. 2 for 2:3
    aspect_h: int       # e.g. 3 for 2:3
    target_w: int       # pixels
    target_h: int       # pixels
    max_kb: int         # raw file-size ceiling

    @property
    def aspect_label(self) -> str:
        return f"{self.aspect_w}:{self.aspect_h}"

    @property
    def target_px(self) -> tuple[int, int]:
        return (self.target_w, self.target_h)

    @property
    def max_bytes(self) -> int:
        return self.max_kb * 1024


# ── Specs sourced from reference.json ──────────────────────────────────────────
_ARTWORK_SPECS: Mapping[ArtworkType, ArtworkSpec] = {
    ArtworkType.POSTER: ArtworkSpec(
        artwork_type=ArtworkType.POSTER,
        aspect_w=2,
        aspect_h=3,
        target_w=600,
        target_h=900,
        max_kb=200,
    ),
    ArtworkType.BANNER: ArtworkSpec(
        artwork_type=ArtworkType.BANNER,
        aspect_w=16,
        aspect_h=9,
        target_w=1280,
        target_h=720,
        max_kb=200,
    ),
    ArtworkType.THUMBNAIL: ArtworkSpec(
        artwork_type=ArtworkType.THUMBNAIL,
        aspect_w=16,
        aspect_h=9,
        target_w=640,
        target_h=360,
        max_kb=200,
    ),
}


def get_spec(artwork_type: ArtworkType) -> ArtworkSpec:
    """Return the validation spec for the given artwork type."""
    try:
        return _ARTWORK_SPECS[artwork_type]
    except KeyError as exc:  # pragma: no cover -- guarded by enum
        raise ValueError(f"Unknown artwork type: {artwork_type!r}") from exc


def all_specs() -> Mapping[ArtworkType, ArtworkSpec]:
    """Return all artwork specs (read-only view)."""
    return _ARTWORK_SPECS


__all__ = ["ArtworkSpec", "all_specs", "get_spec"]