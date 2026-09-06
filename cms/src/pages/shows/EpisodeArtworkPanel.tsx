/**
 * EpisodeArtworkPanel \u2014 per-episode artwork upload UI (Phase 7C).
 *
 * Displays three slots (poster / banner / thumbnail) with:
 *   - live image preview
 *   - client-side dimension + size validation before upload
 *   - backend 422 error display
 *   - delete functionality
 *   - per-slot loading / error states
 */
import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  ARTWORK_SPECS,
  ARTWORK_TYPES_ORDERED,
  readImageDimensions,
  validateArtworkClient,
} from "../../artwork/specs";
import {
  ApiError,
  PermissionDeniedError,
} from "../../api/client";
import {
  useDeleteArtwork,
  useUploadArtwork,
} from "../../hooks/useEpisodeArtwork";
import type { Artwork, ArtworkType, Episode } from "../../types/api";
import "./EpisodeArtworkPanel.css";

interface Props {
  episode: Episode;
}

/** Get the current Artwork record for a given type, or null. */
function getArtwork(
  artwork: Artwork[],
  type: ArtworkType,
): Artwork | undefined {
  return artwork.find((a) => a.artwork_type === type);
}

export function EpisodeArtworkPanel({ episode }: Props) {
  return (
    <div className="artwork-panel" data-testid="artwork-panel">
      <h3 className="artwork-panel__title">Artwork</h3>
      <div className="artwork-panel__slots">
        {ARTWORK_TYPES_ORDERED.map((type) => (
          <ArtworkSlot key={type} episode={episode} artworkType={type} />
        ))}
      </div>
    </div>
  );
}

// \u2500\u2500 Per-slot component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

interface SlotProps {
  episode: Episode;
  artworkType: ArtworkType;
}

function ArtworkSlot({ episode, artworkType }: SlotProps) {
  const spec = ARTWORK_SPECS[artworkType];
  // artwork may be absent if the episode was fetched before artwork was added
  const artwork = episode.artwork ?? [];
  const currentArtwork = getArtwork(artwork, artworkType);

  const uploadMutation = useUploadArtwork();
  const deleteMutation = useDeleteArtwork();

  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `artwork-input-${episode.id}-${artworkType}`;

  const isWorking =
    uploadMutation.isPending || deleteMutation.isPending;

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      setClientErrors([]);
      setBackendError(null);

      const file = e.target.files?.[0];
      if (!file) return;

      // Revoke previous preview URL.
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      // Client-side validation: check dimensions first.
      let dims: { width: number; height: number } | null = null;
      try {
        dims = await readImageDimensions(file);
      } catch {
        // not an image \u2014 dims stays null
      }

      const result = validateArtworkClient(artworkType, file, dims ?? undefined);
      if (!result.ok) {
        setClientErrors(result.errors);
        setPreviewUrl(URL.createObjectURL(file));
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      try {
        await uploadMutation.mutateAsync({
          episode_id: episode.id,
          artwork_type: artworkType,
          file,
        });
        setBackendError(null);
      } catch (err) {
        if (err instanceof PermissionDeniedError) {
          setBackendError("You do not have permission to upload artwork.");
        } else if (err instanceof ApiError) {
          setBackendError(err.message);
        } else {
          setBackendError("Upload failed. Please try again.");
        }
      }
    },
    [artworkType, episode.id, previewUrl, uploadMutation],
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync({
        episode_id: episode.id,
        artwork_type: artworkType,
      });
      setPendingDelete(false);
      setBackendError(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        setBackendError("You do not have permission to delete artwork.");
      } else if (err instanceof ApiError) {
        setBackendError(err.message);
      } else {
        setBackendError("Delete failed. Please try again.");
      }
      setPendingDelete(false);
    }
  }, [artworkType, deleteMutation, episode.id, previewUrl]);

  const artworkUrl = currentArtwork?.storage_key
    ? `/storage/${currentArtwork.storage_key}`
    : null;

  const displayUrl = previewUrl ?? artworkUrl;

  return (
    <>
      <div className="artwork-slot">
        <label className="artwork-slot__label" htmlFor={inputId}>
          {spec.label}
          <span className="artwork-slot__spec">{spec.helpText}</span>
        </label>

        {displayUrl ? (
          <div className="artwork-slot__preview">
            <img
              src={displayUrl}
              alt={`${spec.label} artwork`}
              className="artwork-slot__img"
              data-testid={`artwork-img-${artworkType}`}
            />
            {!isWorking && (
              <button
                type="button"
                className="artwork-slot__delete btn btn--ghost"
                onClick={() => setPendingDelete(true)}
                data-testid={`artwork-delete-${artworkType}`}
                aria-label={`Remove ${spec.label.toLowerCase()} artwork`}
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          <div
            className={`artwork-slot__drop${clientErrors.length > 0 ? " has-error" : ""}`}
            onClick={() => !isWorking && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                inputRef.current?.click();
              }
            }}
            data-testid={`artwork-drop-${artworkType}`}
          >
            <span className="artwork-slot__drop-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </span>
            <span className="artwork-slot__drop-text">
              Click to upload or drag an image here
            </span>
            <span className="artwork-slot__drop-hint">
              {spec.aspectLabel} \u00b7 {Math.round(spec.maxBytes / 1024)} KB max
            </span>
          </div>
        )}

        {isWorking && (
          <div className="artwork-slot__working" data-testid={`artwork-working-${artworkType}`}>
            <div className="artwork-slot__spinner" aria-hidden="true" />
            <span>{uploadMutation.isPending ? "Uploading\u2026" : "Removing\u2026"}</span>
          </div>
        )}

        {clientErrors.length > 0 && !isWorking && (
          <ul className="artwork-slot__errors" data-testid={`artwork-client-errors-${artworkType}`}>
            {clientErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}

        {backendError && (
          <p
            className="artwork-slot__backend-error"
            role="alert"
            data-testid={`artwork-backend-error-${artworkType}`}
          >
            {backendError}
          </p>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="artwork-slot__file-input"
          onChange={handleFileChange}
          disabled={isWorking}
        />
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${spec.label.toLowerCase()} artwork?`}
          message={`This will permanently delete the ${spec.label.toLowerCase()} image. You will need to re-upload a replacement.`}
          confirmLabel="Remove"
          variant="danger"
          isWorking={deleteMutation.isPending}
          onClose={() => setPendingDelete(false)}
          onConfirm={handleDelete}
          testId="artwork-delete-confirm"
        />
      )}
    </>
  );
}
