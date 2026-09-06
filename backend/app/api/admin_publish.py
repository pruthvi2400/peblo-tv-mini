"""
Admin-only catalogue publishing + history (Phase 6).

Endpoints (admin role required for /catalog/publish;
editor or admin for /catalog/publish-runs):

  POST /admin/catalog/publish
      Run the atomic publish pipeline.
      200 on success (returns the published catalogue + counts).
      422 on validation failure (returns the validation issues
          and a failed PublishRun record).
      500 on storage / build failure (returns 500 + the
          failure message).

  GET /admin/catalog/publish-runs
      Newest-first PublishRun history (read-only).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import AdminDep, DBSession, EditorDep
from app.models.publish import PublishRun
from app.schemas.publish import PublishRunRead
from app.services import catalogue_publisher
from app.services.errors import ServiceError


router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/catalog/publish")
def publish_catalog(db: DBSession, admin: AdminDep):
    """Run the atomic publish pipeline.

    Returns 200 on success, 422 on blocking validation
    issues, 500 on storage / pipeline failure.
    """
    result = catalogue_publisher.publish_catalog(db, user=admin)
    body = {
        "status": result.status,
        "run_id": result.run_id,
        "started_at": result.started_at,
        "completed_at": result.completed_at,
        "shows_count": result.shows_count,
        "seasons_count": result.seasons_count,
        "episodes_count": result.episodes_count,
    }
    if result.validation is not None:
        body["validation"] = result.validation
    if result.catalogue is not None:
        body["catalogue"] = result.catalogue
    if result.error_message:
        body["error_message"] = result.error_message

    if result.status == "completed":
        return body

    if result.validation is not None:
        # Validation failure: 422 with the issues attached.
        err = ServiceError(
            result.error_message or "Validation failed.",
            code="validation_failed",
            details={"validation": result.validation},
        )
        err.status_code = 422
        raise err

    # Storage or pipeline failure: 500.
    err = ServiceError(
        result.error_message or "Publish pipeline failed.",
        code="publish_failed",
    )
    err.status_code = 500
    raise err


@router.get("/catalog/publish-runs", response_model=list[PublishRunRead])
def list_publish_runs(
    db: DBSession,
    _user: EditorDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Newest-first list of PublishRun history rows.

    Read-only; requires editor or admin.
    """
    offset = (page - 1) * page_size
    runs = (
        db.query(PublishRun)
        .order_by(PublishRun.started_at.desc(), PublishRun.id.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return [PublishRunRead.model_validate(r) for r in runs]


__all__ = ["router"]
