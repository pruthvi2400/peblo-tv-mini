"""
Artwork upload endpoint.

Routes:
    POST /api/episodes/{episode_id}/artwork
        multipart/form-data:
            artwork_type: "poster" | "banner" | "thumbnail"  (form field)
            file:         the image bytes                      (file field)

Responses:
    201  Artwork created/replaced                -> ArtworkRead
    401  Authentication required                 -> {detail}
    403  Authenticated but insufficient role     -> {detail}
    404  Episode not found                       -> {detail, code, field}
    422  Image validation failed (editor-friendly message)
    500  Storage backend failure                 -> {detail, code}

The endpoint never trusts the uploaded Content-Type, filename, or
extension. The service layer opens the bytes with Pillow and enforces
the per-type aspect ratio, pixel dimensions, and size ceiling
sourced from reference.json.

Both endpoints require an authenticated editor or admin (Phase 5).
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, Response, UploadFile, status

from app.api.deps import DBSession, EditorDep
from app.schemas.artwork import ArtworkRead
from app.services import artwork as artwork_service


router = APIRouter(prefix="/api/episodes", tags=["artwork"])


@router.post(
    "/{episode_id}/artwork",
    response_model=ArtworkRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_episode_artwork(
    episode_id: int,
    artwork_type: str = Form(
        ...,
        description=(
            "Artwork type to upload. Must be one of: "
            "poster, banner, thumbnail."
        ),
    ),
    file: UploadFile = File(
        ...,
        description=(
            "The image file. JPEG, PNG, or WebP. The service opens the "
            "bytes with Pillow and enforces the per-type size, aspect, "
            "and pixel dimensions from reference.json."
        ),
    ),
    db: DBSession = ...,
    _user: EditorDep = ...,
):
    """
    Upload or replace an artwork asset for an episode.

    The (episode_id, artwork_type) pair is unique, so re-uploading the
    same type replaces the existing record and blob. The previous
    blob is removed.
    """
    raw = await file.read()
    if not raw:
        raise artwork_service.ArtworkUploadError(
            "The uploaded file is empty. Please choose a non-empty image.",
            code="empty_file",
        )

    record = artwork_service.upload_artwork(
        db=db,
        episode_id=episode_id,
        artwork_type=artwork_type,
        raw=raw,
        content_type=file.content_type or "image/jpeg",
    )
    return record


@router.delete(
    "/{episode_id}/artwork/{artwork_type}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_episode_artwork(
    episode_id: int,
    artwork_type: str,
    db: DBSession,
    _user: EditorDep,
):
    """Delete a single artwork asset (DB record + blob). 404 if absent."""
    artwork_service.delete_artwork(
        db=db,
        episode_id=episode_id,
        artwork_type=artwork_type,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]