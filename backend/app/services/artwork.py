"""
Artwork upload + validation service (Phase 4).

The upload endpoint delegates here. This module is the ONLY place that:

  * opens the uploaded bytes with Pillow (so the file is validated as
    an actual image, not by Content-Type / filename / extension);
  * enforces the per-type aspect ratio, exact pixel dimensions, and
    maximum file size defined in `app.services.artwork_specs`;
  * writes the blob to the configured `Storage` backend;
  * upserts the `Artwork` DB record.

The DB record is created/updated ONLY after both validation and
storage succeed. If storage fails no record is left pointing at a
file that doesn't exist. If the DB write fails after a successful
storage write the previously stored blob is deleted so we don't leak
orphans.
"""

from __future__ import annotations

import io
import logging
from typing import BinaryIO

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.artwork import Artwork, ArtworkType
from app.models.episode import Episode
from app.services.artwork_specs import ArtworkSpec, get_spec
from app.services.errors import NotFoundError, ValidationFailure
from app.services.storage import Storage, StorageError, get_storage


logger = logging.getLogger(__name__)


# ── Public constants ──────────────────────────────────────────────────────────


# Maximum upload size we'll buffer at all (8 MB). The 200 KB per-file
# limit is enforced after decoding; this larger ceiling just prevents a
# malicious 2 GB upload from OOMing the server.
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

# Mime types we accept (Pillow decodes all of these natively).
_ACCEPTED_MIME_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)


# ── Public errors (specific, editor-friendly) ────────────────────────────────


class ArtworkUploadError(ValidationFailure):
    """
    Raised when an artwork upload fails validation. The base class
    (ValidationFailure -> HTTP 422) carries the structured error
    envelope returned to the client.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str,
        details: dict | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            field="file",
            details=details or {},
        )


# ── Validation helpers ────────────────────────────────────────────────────────


def _coerce_artwork_type(value: str | ArtworkType) -> ArtworkType:
    """Accept either the string ('poster') or the enum and return ArtworkType."""
    if isinstance(value, ArtworkType):
        return value
    try:
        return ArtworkType(value)
    except ValueError as exc:
        raise ArtworkUploadError(
            (
                f"Unknown artwork type {value!r}. "
                f"Must be one of: poster, banner, thumbnail."
            ),
            code="invalid_artwork_type",
            details={"artwork_type": str(value)},
        ) from exc


def _decode_image(raw: bytes) -> Image.Image:
    """Open `raw` bytes with Pillow. Raises ArtworkUploadError on failure."""
    try:
        img = Image.open(io.BytesIO(raw))
        # Force actual decode so a file with a valid header but corrupt
        # pixel data is rejected. `Image.verify` only checks the header.
        img.load()
        return img
    except UnidentifiedImageError as exc:
        raise ArtworkUploadError(
            (
                "The uploaded file is not a valid image. "
                "Please upload a JPEG, PNG, or WebP file."
            ),
            code="invalid_image",
        ) from exc
    except Exception as exc:  # corrupt pixel data, truncated file, etc.
        raise ArtworkUploadError(
            (
                "The uploaded file is corrupted and could not be read. "
                "Please re-export the image and try again."
            ),
            code="corrupted_image",
        ) from exc


def _check_dimensions(spec: ArtworkSpec, width: int, height: int) -> None:
    if width != spec.target_w or height != spec.target_h:
        raise ArtworkUploadError(
            (
                f"{spec.artwork_type.value.title()} images must be "
                f"{spec.target_w}\u00d7{spec.target_h} pixels "
                f"({spec.aspect_label}). "
                f"The uploaded image is {width}\u00d7{height}."
            ),
            code="invalid_dimensions",
            details={
                "expected_width": spec.target_w,
                "expected_height": spec.target_h,
                "actual_width": width,
                "actual_height": height,
                "artwork_type": spec.artwork_type.value,
            },
        )


def _check_aspect(spec: ArtworkSpec, width: int, height: int) -> None:
    # Cross-multiplied comparison avoids floating point drift.
    if width * spec.aspect_h != height * spec.aspect_w:
        raise ArtworkUploadError(
            (
                f"{spec.artwork_type.value.title()} images must use a "
                f"{spec.aspect_label} aspect ratio."
            ),
            code="invalid_aspect_ratio",
            details={
                "expected_aspect": spec.aspect_label,
                "artwork_type": spec.artwork_type.value,
            },
        )


def _check_size(spec: ArtworkSpec, size_bytes: int) -> None:
    if size_bytes > spec.max_bytes:
        actual_kb = (size_bytes + 1023) // 1024
        raise ArtworkUploadError(
            (
                f"{spec.artwork_type.value.title()} images must be no "
                f"larger than {spec.max_kb} KB. "
                f"The uploaded file is {actual_kb} KB."
            ),
            code="file_too_large",
            details={
                "max_kb": spec.max_kb,
                "actual_kb": actual_kb,
                "artwork_type": spec.artwork_type.value,
            },
        )


def validate_image_bytes(
    raw: bytes,
    artwork_type: ArtworkType | str,
) -> tuple[Image.Image, ArtworkSpec]:
    """
    Validate a raw image upload end-to-end and return the decoded
    Pillow image + spec. Raises `ArtworkUploadError` (HTTP 422) on any
    problem with an editor-friendly message.
    """
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ArtworkUploadError(
            (
                f"The uploaded file is too large. "
                f"Please upload an image smaller than "
                f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
            ),
            code="file_too_large",
            details={
                "max_bytes": MAX_UPLOAD_BYTES,
                "actual_bytes": len(raw),
            },
        )

    atype = _coerce_artwork_type(artwork_type)
    spec = get_spec(atype)

    img = _decode_image(raw)
    width, height = img.size

    # Dimension check is sufficient for aspect, but the spec asks for
    # both checks expressed as separate, editor-friendly errors.
    _check_aspect(spec, width, height)
    _check_dimensions(spec, width, height)
    _check_size(spec, len(raw))

    return img, spec


# ── Upload orchestration ──────────────────────────────────────────────────────


def _build_storage_key(episode_id: int, atype: ArtworkType) -> str:
    """
    Build a stable, human-readable storage key for an (episode, type)
    pair. Re-uploads of the same (episode, type) overwrite the same
    blob so we never accumulate dead files when the same artwork is
    replaced.
    """
    return f"episodes/{episode_id}/{atype.value}.jpg"


def _get_episode(db: Session, episode_id: int) -> Episode:
    episode = db.get(Episode, episode_id)
    if episode is None:
        raise NotFoundError(
            f"Episode with id={episode_id} not found.",
            field="episode_id",
        )
    return episode


def _find_existing(
    db: Session, episode_id: int, atype: ArtworkType
) -> Artwork | None:
    return db.execute(
        select(Artwork).where(
            Artwork.episode_id == episode_id,
            Artwork.artwork_type == atype,
        )
    ).scalar_one_or_none()


def upload_artwork(
    db: Session,
    episode_id: int,
    artwork_type: str | ArtworkType,
    raw: bytes,
    *,
    storage: Storage | None = None,
    content_type: str = "image/jpeg",
) -> Artwork:
    """
    Validate `raw` as an artwork image, save it to storage, and
    upsert the corresponding `Artwork` record.

    Order of operations (deliberate):
        1. Ensure the episode exists            (NotFoundError -> 404)
        2. Validate the image                   (ArtworkUploadError -> 422)
        3. Save to storage                      (StorageError -> 500)
        4. Upsert the DB record                 (IntegrityError -> 500)
        5. On DB failure after a successful save, delete the blob
           so we never leave a stored file without a record.

    Returns the upserted `Artwork` row.
    """
    if storage is None:
        storage = get_storage()

    episode = _get_episode(db, episode_id)
    atype = _coerce_artwork_type(artwork_type)

    # 1 + 2. Validate the image bytes BEFORE any I/O.
    img, spec = validate_image_bytes(raw, atype)
    mime = _normalise_mime(img.format, content_type)

    # 3. Save the blob. Storage is atomic; partial writes are impossible.
    storage_key = _build_storage_key(episode.id, atype)
    try:
        storage.save(storage_key, raw, content_type=mime)
    except StorageError:
        # No DB record is created; nothing to roll back.
        logger.exception(
            "Storage failure while saving artwork for episode %s type %s",
            episode_id, atype,
        )
        raise

    # 4. Upsert the DB record.
    existing = _find_existing(db, episode.id, atype)
    if existing is not None:
        # Replace in-place; preserve the PK so any external references
        # (catalog manifest, CDN purge lists) keep working.
        previous_key = existing.storage_key
        existing.storage_key = storage_key
        existing.width = spec.target_w
        existing.height = spec.target_h
        existing.size_bytes = len(raw)
        existing.mime_type = mime
        record = existing
        # If we replaced a different blob (unlikely with our key scheme
        # but still possible), tidy up.
        if previous_key and previous_key != storage_key:
            try:
                storage.delete(previous_key)
            except StorageError:
                logger.warning(
                    "Failed to delete previous artwork blob %s",
                    previous_key,
                )
    else:
        record = Artwork(
            episode_id=episode.id,
            artwork_type=atype,
            storage_key=storage_key,
            width=spec.target_w,
            height=spec.target_h,
            size_bytes=len(raw),
            mime_type=mime,
        )
        db.add(record)

    try:
        db.commit()
    except Exception:
        # 5. Roll back the DB and remove the blob we just saved so we
        # never have a file with no record pointing at it.
        db.rollback()
        try:
            storage.delete(storage_key)
        except StorageError:
            logger.exception(
                "Failed to clean up artwork blob %s after DB rollback",
                storage_key,
            )
        raise

    db.refresh(record)
    return record


def delete_artwork(
    db: Session,
    episode_id: int,
    artwork_type: str | ArtworkType,
    *,
    storage: Storage | None = None,
) -> None:
    """Remove an artwork record + its blob. 404 if absent."""
    if storage is None:
        storage = get_storage()

    atype = _coerce_artwork_type(artwork_type)
    episode = _get_episode(db, episode_id)
    record = _find_existing(db, episode.id, atype)
    if record is None:
        raise NotFoundError(
            (
                f"No {atype.value} artwork for episode id={episode_id}."
            ),
            field="artwork_type",
        )

    storage_key = record.storage_key
    db.delete(record)
    db.commit()
    try:
        storage.delete(storage_key)
    except StorageError:
        logger.warning(
            "Artwork DB record deleted but blob %s could not be removed.",
            storage_key,
        )


def _normalise_mime(pil_format: str | None, declared: str) -> str:
    """Best-effort mime type: trust Pillow's format over the client's header."""
    fmt = (pil_format or "").upper()
    if fmt == "JPEG":
        return "image/jpeg"
    if fmt == "PNG":
        return "image/png"
    if fmt == "WEBP":
        return "image/webp"
    # Fall back to the declared content-type if Pillow recognised the
    # file but the format is one we don't advertise.
    if declared in _ACCEPTED_MIME_TYPES:
        return declared
    return "image/jpeg"


def read_file_like(fp: BinaryIO) -> bytes:
    """Read a SpooledTemporaryFile / upload file fully into memory."""
    fp.seek(0)
    return fp.read()


__all__ = [
    "ArtworkUploadError",
    "MAX_UPLOAD_BYTES",
    "delete_artwork",
    "read_file_like",
    "upload_artwork",
    "validate_image_bytes",
]