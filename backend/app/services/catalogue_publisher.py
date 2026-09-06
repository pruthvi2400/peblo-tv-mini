"""
Catalogue publisher (Phase 6).

Atomic publication pipeline:
  1. Create a PublishRun row (status=RUNNING).
  2. Run validation_report; on blocking issues -> mark
     the run FAILED, return issues, do NOT touch live.
  3. Build the catalogue in memory (catalogue_builder).
  4. Serialise deterministically.
  5. Write immutable version blob: catalogue/versions/<run-id>.json
  6. Atomically update LIVE pointer via temp + os.replace.
  7. Mark PublishRun COMPLETED with counts.

Failure handling:
  * Validation failure -> PublishRun FAILED, live untouched.
  * Build/serialise failure -> PublishRun FAILED, live untouched.
  * Version write failure -> PublishRun FAILED, live untouched.
  * Live pointer failure -> PublishRun FAILED, previous live
    remains active; orphan version may exist in versions/.

Reads always see previous or new complete catalogue; never
a partial one.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.publish import PublishRun, PublishStatus
from app.models.user import User
from app.services import catalogue_builder, validation_report
from app.services.storage import (
    LocalStorage,
    Storage,
    StorageError,
    get_storage,
)


logger = logging.getLogger(__name__)


LIVE_KEY = "catalogue/live.json"
VERSIONS_PREFIX = "catalogue/versions/"


@dataclass
class PublishResult:
    status: str
    run_id: int | None
    started_at: datetime | None
    completed_at: datetime | None
    shows_count: int
    seasons_count: int
    episodes_count: int
    error_message: str | None = None
    validation: dict[str, Any] | None = None
    catalogue: dict[str, Any] | None = None


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)

def _start_publish_run(db: Session, *, user: User) -> PublishRun:
    run = PublishRun(
        triggered_by_user_id=user.id if user is not None else None,
        started_at=_utc_now(),
        status=PublishStatus.RUNNING,
        shows_count=0, seasons_count=0, episodes_count=0,
    )
    db.add(run); db.commit(); db.refresh(run)
    return run


def _fail_run(db, run, *, message, details=None):
    run.status = PublishStatus.FAILED
    run.completed_at = _utc_now()
    run.error_message = message[:500] if message else None
    if details:
        run.error_details = details[:50000] if details else None
    db.commit()


def _complete_run(db, run, *, shows_count, seasons_count, episodes_count):
    run.status = PublishStatus.COMPLETED
    run.completed_at = _utc_now()
    run.shows_count = shows_count
    run.seasons_count = seasons_count
    run.episodes_count = episodes_count
    db.commit()


def _serialise_catalogue(payload):
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

def _atomic_pointer_update(storage, key, data):
    if isinstance(storage, LocalStorage):
        target = storage._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=str(target.parent))
        tmp_path = target.parent / tmp_name
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data); fh.flush()
                try: os.fsync(fh.fileno())
                except OSError: pass
            os.replace(tmp_path, target)
        except Exception:
            try: tmp_path.unlink(missing_ok=True)
            except Exception: pass
            raise
    else:
        storage.save(key, data, "application/json")


def _version_key(run_id):
    return f"{VERSIONS_PREFIX}{run_id}.json"

def publish_catalog(db: Session, *, user: User, storage: Storage | None = None) -> PublishResult:
    if storage is None:
        storage = get_storage()
    started_at = _utc_now()
    run = _start_publish_run(db, user=user)
    report = validation_report.build_validation_report(db)
    if not report.can_publish:
        msg = (f"Validation failed: {report.shows_scanned} show(s), "
               f"{report.episodes_scanned} episode(s) scanned, "
               f"{sum(1 for i in report.issues if i.severity == 'blocking')} blocking issue(s).")
        details = json.dumps(report.to_dict(), sort_keys=True, ensure_ascii=False)
        try: _fail_run(db, run, message=msg, details=details)
        except Exception:
            logger.exception("Failed to record failed run %s", run.id); db.rollback()
        return PublishResult(status="failed", run_id=run.id, started_at=started_at,
                             completed_at=_utc_now(), shows_count=0, seasons_count=0,
                             episodes_count=0, error_message=msg, validation=report.to_dict())
    try:
        catalogue = catalogue_builder.build_catalogue(
            db, published_at=started_at, publish_run_id=run.id, storage=storage)
    except Exception as exc:
        msg = f"Catalogue build failed: {exc}"
        try: _fail_run(db, run, message=msg, details=traceback.format_exc())
        except Exception:
            logger.exception("Failed to record failed run %s", run.id); db.rollback()
        return PublishResult(status="failed", run_id=run.id, started_at=started_at,
                             completed_at=_utc_now(), shows_count=0, seasons_count=0,
                             episodes_count=0, error_message=msg)
    shows_count = sum(len(s["shows"]) for s in catalogue["sections"])
    seasons_count = sum(len(show["seasons"]) for section in catalogue["sections"] for show in section["shows"])
    episodes_count = (
        sum(len(season["episodes"]) for section in catalogue["sections"]
            for show in section["shows"] for season in show["seasons"])
        + sum(len(show["trailers"]) for section in catalogue["sections"]
              for show in section["shows"])
    )
    try:
        payload_bytes = _serialise_catalogue(catalogue)
    except Exception as exc:
        msg = f"Catalogue serialisation failed: {exc}"
        try: _fail_run(db, run, message=msg, details=traceback.format_exc())
        except Exception:
            logger.exception("Failed to record failed run %s", run.id); db.rollback()
        return PublishResult(status="failed", run_id=run.id, started_at=started_at,
                             completed_at=_utc_now(), shows_count=shows_count,
                             seasons_count=seasons_count, episodes_count=episodes_count,
                             error_message=msg)
    version_key = _version_key(run.id)
    try:
        storage.save(version_key, payload_bytes, "application/json")
    except (StorageError, Exception) as exc:
        msg = f"Failed to write catalogue version: {exc}"
        try: _fail_run(db, run, message=msg, details=traceback.format_exc())
        except Exception:
            logger.exception("Failed to record failed run %s", run.id); db.rollback()
        return PublishResult(status="failed", run_id=run.id, started_at=started_at,
                             completed_at=_utc_now(), shows_count=shows_count,
                             seasons_count=seasons_count, episodes_count=episodes_count,
                             error_message=msg)
    try:
        _atomic_pointer_update(storage, LIVE_KEY, payload_bytes)
    except Exception as exc:
        msg = f"Failed to update live catalogue pointer: {exc}"
        try: _fail_run(db, run, message=msg, details=traceback.format_exc())
        except Exception:
            logger.exception("Failed to record failed run %s", run.id); db.rollback()
        return PublishResult(status="failed", run_id=run.id, started_at=started_at,
                             completed_at=_utc_now(), shows_count=shows_count,
                             seasons_count=seasons_count, episodes_count=episodes_count,
                             error_message=msg)
    try:
        _complete_run(db, run, shows_count=shows_count, seasons_count=seasons_count, episodes_count=episodes_count)
    except Exception:
        logger.exception("Live updated but failed to mark run %s COMPLETED.", run.id)
        db.rollback()
    return PublishResult(status="completed", run_id=run.id, started_at=started_at,
                         completed_at=_utc_now(), shows_count=shows_count,
                         seasons_count=seasons_count, episodes_count=episodes_count,
                         catalogue=catalogue)


__all__ = ["LIVE_KEY", "PublishResult", "publish_catalog"]
