/**
 * Artwork validation specs (Phase 7C).
 *
 * Mirror of `backend/app/services/artwork_specs.py` — the source of
 * truth on the server. The backend re-validates with Pillow and these
 * dimensions/size/format; the CMS uses the same numbers for fast
 * client-side feedback so editors see issues BEFORE uploading.
 */
import type { ArtworkType } from '../types/api';

export interface ArtworkSpec {
  artwork_type: ArtworkType;
  /** Human label. */
  label: string;
  /** Aspect ratio "W:H" (e.g. "2:3"). */
  aspectLabel: string;
  /** Required pixel dimensions [W, H]. */
  target: { w: number; h: number };
  /** Max file size in bytes. */
  maxBytes: number;
  /** Human description for the helper text. */
  helpText: string;
}

export const ARTWORK_SPECS: Record<ArtworkType, ArtworkSpec> = {
  poster: {
    artwork_type: 'poster',
    label: 'Poster',
    aspectLabel: '2:3',
    target: { w: 600, h: 900 },
    maxBytes: 200 * 1024,
    helpText: '600 \u00d7 900 px, 2:3 aspect ratio, \u2264 200 KB.',
  },
  banner: {
    artwork_type: 'banner',
    label: 'Banner',
    aspectLabel: '16:9',
    target: { w: 1280, h: 720 },
    maxBytes: 200 * 1024,
    helpText: '1280 \u00d7 720 px, 16:9 aspect ratio, \u2264 200 KB.',
  },
  thumbnail: {
    artwork_type: 'thumbnail',
    label: 'Thumbnail',
    aspectLabel: '16:9',
    target: { w: 640, h: 360 },
    maxBytes: 200 * 1024,
    helpText: '640 \u00d7 360 px, 16:9 aspect ratio, \u2264 200 KB.',
  },
};

export const ARTWORK_TYPES_ORDERED: ArtworkType[] = [
  'poster',
  'banner',
  'thumbnail',
];

/** Image mime types accepted by the backend. */
export const ACCEPTED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export interface ClientValidationResult {
  ok: boolean;
  /** One or more human-readable problems. Empty when ok. */
  errors: string[];
}

/**
 * Fast client-side validation of a candidate File against the artwork
 * spec. Backend validation is authoritative; this is for fast feedback
 * so editors don't burn a network round-trip on every obvious mistake.
 */
export function validateArtworkClient(
  type: ArtworkType,
  file: File,
  meta?: { width: number; height: number },
): ClientValidationResult {
  const errors: string[] = [];
  const spec = ARTWORK_SPECS[type];

  if (!ACCEPTED_IMAGE_MIMES.includes(
    file.type as (typeof ACCEPTED_IMAGE_MIMES)[number],
  )) {
    errors.push(
      `File type not allowed. Please upload a JPEG, PNG, or WebP image.`,
    );
  }

  if (file.size <= 0) {
    errors.push('The file is empty.');
  } else if (file.size > spec.maxBytes) {
    const kb = (file.size / 1024).toFixed(0);
    errors.push(
      `File is ${kb} KB, but the maximum allowed for ${spec.label.toLowerCase()} artwork is ${Math.round(spec.maxBytes / 1024)} KB.`,
    );
  }

  if (meta) {
    // Check exact dimensions first.
    if (meta.width !== spec.target.w || meta.height !== spec.target.h) {
      errors.push(
        `Image is ${meta.width}×${meta.height}px, but ${spec.label.toLowerCase()} artwork must be exactly ${spec.target.w}×${spec.target.h}px.`,
      );
    }
    // Also check aspect ratio (accepts any valid scale of the target ratio).
    const targetRatio = spec.target.w / spec.target.h;
    const actualRatio = meta.width / meta.height;
    const tolerance = 0.01;
    if (Math.abs(targetRatio - actualRatio) > tolerance) {
      errors.push(
        `Image aspect ratio is ${meta.width}:${meta.height}, but ${spec.label.toLowerCase()} artwork must be ${spec.aspectLabel}.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Read a File's natural pixel dimensions via an Image element. Returns
 * `null` if the file can't be decoded (e.g. not an image). Always revoke
 * the object URL.
 */
export function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
