"""
Catalogue reader (Phase 6).

Reads the currently-published live catalogue from storage.
Returns the empty-catalogue envelope when nothing has ever
been published, or when the live pointer is missing.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.schemas.catalog import empty_catalogue
from app.services.catalogue_publisher import LIVE_KEY
from app.services.storage import (
    LocalStorage,
    Storage,
    StorageError,
    get_storage,
)


logger = logging.getLogger(__name__)


def _read_local(storage: LocalStorage, key: str) -> bytes | None:
    try:
        target = storage._resolve(key)
    except Exception:
        return None
    if not target.is_file():
        return None
    with open(target, "rb") as fh:
        return fh.read()


def read_live_catalogue(storage: Storage | None = None) -> dict[str, Any]:
    if storage is None:
        storage = get_storage()
    if isinstance(storage, LocalStorage):
        raw = _read_local(storage, LIVE_KEY)
    else:
        # Non-local backends use a Storage.read() convention;
        # in Phase 6 we only ship LocalStorage, but the fallback
        # keeps the API clean for future R2 work.
        return empty_catalogue()
    if not raw:
        return empty_catalogue()
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        logger.exception("Failed to parse live catalogue JSON; returning empty.");
        return empty_catalogue()


__all__ = ["read_live_catalogue"]

