/**
 * Helpers for selecting the right artwork from a catalogue item.
 *
 * The catalogue document stores artwork under per-item `artwork`
 * maps keyed by artwork type (e.g. `poster`, `banner`, `thumbnail`).
 * Different surfaces (hero, card, list) want different types, so
 * these helpers prefer a specific type and fall back to a sensible
 * alternative when that type is absent.
 */

import type { ArtworkMap, ArtworkItem } from '../types/catalog';

/** Pick an artwork URL of a specific type, if present. */
function urlOf(artwork: ArtworkMap | undefined, type: string): string | null {
  const item: ArtworkItem | undefined = artwork?.[type];
  if (!item) return null;
  if (!item.url) return null;
  return item.url;
}

/** Hero artwork: prefer `banner`, fall back to `poster`. */
export function pickHeroArtwork(artwork: ArtworkMap | undefined): string | null {
  return urlOf(artwork, 'banner') ?? urlOf(artwork, 'poster');
}

/** Card artwork: prefer `poster`, fall back to `banner`/`thumbnail`. */
export function pickPosterArtwork(artwork: ArtworkMap | undefined): string | null {
  return (
    urlOf(artwork, 'poster') ??
    urlOf(artwork, 'banner') ??
    urlOf(artwork, 'thumbnail')
  );
}

/** Thumbnail artwork: prefer `thumbnail`, fall back to `poster`. */
export function pickThumbnailArtwork(artwork: ArtworkMap | undefined): string | null {
  return urlOf(artwork, 'thumbnail') ?? urlOf(artwork, 'poster');
}
