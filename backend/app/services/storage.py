"""
Storage abstraction (Phase 4).

The API + service layers never touch the filesystem or a remote
object-store SDK directly. They depend on the `Storage` protocol so
that a production deployment can drop in a Cloudflare R2 / S3 backend
by registering another implementation -- without changing any caller.

Public API
----------

    class Storage(Protocol):
        def save(key, data, content_type) -> str: ...
        def delete(key) -> None: ...
        def exists(key) -> bool: ...
        def get_url(key) -> str: ...

    get_storage() -> Storage  (cached, configured by settings)

The default backend is `LocalStorage`, which writes blobs to the
directory named by `settings.STORAGE_LOCAL_ROOT` and serves them under
`settings.STORAGE_LOCAL_URL_PREFIX` (mounted by `app.main`).

Atomic write semantics
----------------------

`LocalStorage.save` writes the blob to a sibling `.tmp-<uuid>` file and
then renames it to the final path. Rename on a single filesystem is
atomic, so a concurrent reader will see either the old blob or the new
blob -- never a half-written one. If the process crashes mid-write the
stale temp file is left behind but the destination is untouched; the
next `save` to the same key will overwrite the temp file.

If `rename` fails the temp file is removed before the exception
propagates so callers (the artwork service) can guarantee "no DB record
without a saved blob".
"""

from __future__ import annotations

import os
import re
import shutil
import threading
import uuid
from pathlib import Path
from typing import Protocol, runtime_checkable

from app.core.config import settings


# ── Errors ─────────────────────────────────────────────────────────────────────


class StorageError(Exception):
    """Base class for storage failures."""


class InvalidStorageKey(StorageError):
    """Raised when a storage key contains path-traversal characters."""


# A safe storage key is:
#   - lowercase
#   - composed of alphanumerics, dash, underscore, dot, slash
#   - never starts with a dot, slash, or contains ".."
# This blocks "../../etc/passwd" style attacks even when keys are
# constructed from user-supplied input.
_SAFE_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9._/-]*$")


def _validate_key(key: str) -> str:
    if not isinstance(key, str) or not key:
        raise InvalidStorageKey("storage key must be a non-empty string")
    if ".." in key.split("/"):
        raise InvalidStorageKey(
            f"storage key contains forbidden segment '..': {key!r}"
        )
    if not _SAFE_KEY_RE.match(key):
        raise InvalidStorageKey(
            f"storage key contains invalid characters: {key!r}"
        )
    return key


# ── Protocol ───────────────────────────────────────────────────────────────────


@runtime_checkable
class Storage(Protocol):
    """Storage backend interface used by the artwork service."""

    def save(self, key: str, data: bytes, content_type: str) -> str:
        """
        Persist `data` at `key`. Returns the canonical storage key
        actually written. `content_type` is a hint for backends that
        store metadata (R2/S3 custom metadata).
        """
        ...

    def delete(self, key: str) -> None:
        """Remove `key`. Silently ignores missing keys."""
        ...

    def exists(self, key: str) -> bool:
        """Return True iff a blob is currently stored at `key`."""
        ...

    def get_url(self, key: str) -> str:
        """
        Return a URL the client can use to fetch the blob. For the
        local backend this is `<STORAGE_LOCAL_URL_PREFIX>/<key>`.
        """
        ...


# ── Local filesystem backend ──────────────────────────────────────────────────


class LocalStorage:
    """
    Storage implementation that writes blobs to the local filesystem.

    Suitable for development + tests. The directory named by
    `STORAGE_LOCAL_ROOT` is created on first use.

    `get_url` returns a relative URL like `/storage/<key>` that is
    served by the static mount in `app.main`.
    """

    def __init__(
        self,
        root: str | os.PathLike[str] | None = None,
        url_prefix: str | None = None,
    ) -> None:
        self._root = Path(
            root if root is not None else settings.STORAGE_LOCAL_ROOT
        ).resolve()
        self._url_prefix = (
            url_prefix
            if url_prefix is not None
            else settings.STORAGE_LOCAL_URL_PREFIX
        ).rstrip("/")
        self._lock = threading.Lock()
        self._root.mkdir(parents=True, exist_ok=True)

    # ── Internal helpers ──────────────────────────────────────────────────
    def _resolve(self, key: str) -> Path:
        safe = _validate_key(key)
        target = (self._root / safe).resolve()
        # Defense in depth: confirm we never escape the root even if the
        # regex above ever changes.
        try:
            target.relative_to(self._root)
        except ValueError as exc:
            raise InvalidStorageKey(
                f"storage key escapes root: {key!r}"
            ) from exc
        return target

    def _url_for(self, key: str) -> str:
        return f"{self._url_prefix}/{_validate_key(key)}"

    # ── Storage protocol ──────────────────────────────────────────────────
    def save(self, key: str, data: bytes, content_type: str) -> str:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)

        # Atomic write: write to .tmp-<uuid> then rename into place.
        tmp_name = f".tmp-{uuid.uuid4().hex}"
        tmp_path = target.parent / tmp_name
        try:
            with open(tmp_path, "wb") as fh:
                fh.write(data)
                fh.flush()
            os.replace(tmp_path, target)
        except Exception:
            # Clean up the temp file so we never leak partial blobs.
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise

        return key

    def delete(self, key: str) -> None:
        target = self._resolve(key)
        try:
            target.unlink(missing_ok=True)
        except FileNotFoundError:
            pass

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()

    def get_url(self, key: str) -> str:
        return self._url_for(key)

    # ── Test helpers ──────────────────────────────────────────────────────
    @property
    def root(self) -> Path:
        """The absolute path of the storage root (for tests + dev tooling)."""
        return self._root

    def clear(self) -> None:
        """
        Recursively remove every blob under the storage root. Intended
        for tests; do not call in production.
        """
        if self._root.exists():
            shutil.rmtree(self._root, ignore_errors=True)
        self._root.mkdir(parents=True, exist_ok=True)


# ── Default-singleton accessor ────────────────────────────────────────────────


_storage_singleton: Storage | None = None
_storage_lock = threading.Lock()


def get_storage() -> Storage:
    """
    Return the process-wide `Storage` instance, selecting the backend
    from `settings.STORAGE_BACKEND`.

    Supported values today:
        "local" -- `LocalStorage`

    Other values raise `StorageError` so an unconfigured production
    environment fails loudly instead of silently falling back to disk.
    """
    global _storage_singleton
    if _storage_singleton is not None:
        return _storage_singleton

    with _storage_lock:
        if _storage_singleton is not None:
            return _storage_singleton

        backend = (settings.STORAGE_BACKEND or "local").lower()
        if backend == "local":
            _storage_singleton = LocalStorage()
        else:
            raise StorageError(
                f"Unknown STORAGE_BACKEND={backend!r}. "
                "Supported values: 'local'."
            )
        return _storage_singleton


def reset_storage_singleton() -> None:
    """
    Drop the cached singleton. Tests use this between cases so each
    test gets a fresh storage root (pointed at a tmp dir).
    """
    global _storage_singleton
    with _storage_lock:
        _storage_singleton = None


__all__ = [
    "InvalidStorageKey",
    "LocalStorage",
    "Storage",
    "StorageError",
    "get_storage",
    "reset_storage_singleton",
]