// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

interface ImageWithFallbackProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  fallback?: string;
  className?: string;
  imgClassName?: string;
}

function deriveAlt(alt?: string): string {
  const t = (alt ?? '').trim();
  return t || 'Image';
}

export function ImageWithFallback({ src, fallback, alt, className, imgClassName, ...imgProps }: ImageWithFallbackProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const isEmpty = !src || src.trim() === '';
  const showImage = !isEmpty && !error;
  return (
    <span className={className} data-testid="image-wrapper" aria-label={deriveAlt(alt)}>
      {showImage ? (
        <img {...imgProps} src={src ?? undefined} alt={deriveAlt(alt)} className={imgClassName} onLoad={() => setLoaded(true)} onError={() => setError(true)} style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease', ...(imgProps.style ?? {}) }} data-testid="image-loaded" />
      ) : (
        <span className="image-fallback" data-testid="image-fallback" style={imgProps.style}>
          {fallback ? <img src={fallback} alt="" aria-hidden="true" className={imgClassName} /> : (
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </span>
      )}
    </span>
  );
}
