"""
Admin endpoints (Phase 4 + Phase 5).

Currently exposes:

    GET /admin/validation-report
        Returns the report from `app.services.validation_report`.
        Requires an authenticated editor or admin (Phase 5).

The publish-catalog placeholder lives in `app.api.admin_publish`
because it is admin-only and Phase 6 will replace the body.

The endpoint is intentionally cheap: a single SELECT per table. The
report reflects the database state at request time and never mutates
anything.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DBSession, EditorDep
from app.services import validation_report as vr_service


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/validation-report")
def validation_report(db: DBSession, _user: EditorDep):
    """
    Inspect the current database and return a list of every problem
    that would block publication.

    Response shape:

        {
          "can_publish": bool,
          "issues":     [ {type, severity, entity, entity_id,
                           title, message, fields}, ... ],
          "summary":    {
              "blocking_issues":  int,
              "by_type":          {code: count, ...},
              "shows_scanned":    int,
              "episodes_scanned": int
          }
        }

    Authentication: editor OR admin (Phase 5).
    """
    report = vr_service.build_validation_report(db)
    return report.to_dict()


__all__ = ["router"]