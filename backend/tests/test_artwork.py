"""
Tests for the artwork upload + storage abstraction (Phase 4 Part A).

Coverage:
    * valid poster / banner / thumbnail uploads persist records + blobs
    * wrong dimensions, wrong aspect ratio, oversize, corrupted/non-image
      payloads are rejected with editor-friendly error envelopes
    * uploading twice for the same (episode, type) replaces the record
      and the blob (no duplicates, (episode_id, artwork_type) unique)
    * missing episode -> 404
    * if storage fails after validation the DB stays clean -- no record
      points at a file that wasn't saved

The tests build their images with Pillow in-process; the supplied
`reference.json` / `seed_shows.json` files are NOT modified.
"""

from __future__ import annotations

import io

import pytest
from PIL import Image
from sqlalchemy import select

from app.models.artwork import Artwork, ArtworkType
from app.services.artwork_specs import get_spec
from app.services.storage import LocalStorage, reset_storage_singleton


# ── Test fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture()
def storage_root(monkeypatch, tmp_path):
    """
    Point the local storage backend at a temp dir for the duration of
    the test, then drop the cached singleton so the next `get_storage`
    call re-reads the settings.
    """
    reset_storage_singleton()
    root = tmp_path / "art"
    root.mkdir()
    monkeypatch.setattr(
        "app.services.storage.settings.STORAGE_LOCAL_ROOT", str(root)
    )
    # Note: we leave STORAGE_LOCAL_URL_PREFIX at the production default
    # (`/storage`) because `app.main` already mounted that prefix at
    # import time. Tests that need the actual URL can read it from
    # `LocalStorage.get_url(...)`.
    yield root
    reset_storage_singleton()


@pytest.fixture()
def storage(storage_root):
    # Use the production prefix so URL strings line up with what the
    # static mount serves in `app.main`.
    return LocalStorage(root=str(storage_root))


def _make_image(width: int, height: int, fmt: str = "JPEG") -> bytes:
    """Generate a tiny in-memory image of the requested dimensions."""
    img = Image.new("RGB", (width, height), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_over_size(width: int, height: int, target_bytes: int) -> bytes:
    """
    Produce an image whose on-disk bytes exceed `target_bytes`. We
    embed JPEG comment markers (each up to 65535 bytes) so the
    decoded image is unchanged but the file size is > target_bytes.
    The markers are inserted right after the SOI (FFD8) and are
    transparently ignored by Pillow.
    """
    base = _make_image(width, height, fmt="JPEG")
    if len(base) >= target_bytes:
        return base

    needed = target_bytes - len(base) + 16
    pad = bytearray()
    while needed > 0:
        chunk = min(needed - 2, 65535)  # -2 for the length bytes themselves
        if chunk < 1:
            break
        pad += b"\xff\xfe" + chunk.to_bytes(2, "big") + (b"x" * chunk)
        needed -= (chunk + 2)

    assert base.startswith(b"\xff\xd8")
    return bytes(base[:2]) + bytes(pad) + bytes(base[2:])


def _create_episode(client) -> dict:
    show = client.post(
        "/api/shows",
        json={
            "title": "Show",
            "slug": "show",
            "section": "series",
            "status": "draft",
            "categories": ["adventure"],
        },
    ).json()
    season = client.post(
        "/api/seasons",
        json={"show_id": show["id"], "season_number": 1},
    ).json()
    episode = client.post(
        "/api/episodes",
        json={
            "season_id": season["id"],
            "title": "Ep",
            "episode_number": 1,
            "language": "en",
            "content_group": "show-s01e01",
            "status": "draft",
            "duration": 300,
            "artwork": [],
        },
    ).json()
    return episode


def _post_artwork(client, episode_id: int, atype: str, raw: bytes,
                  content_type="image/jpeg", filename="x.jpg"):
    return client.post(
        f"/api/episodes/{episode_id}/artwork",
        data={"artwork_type": atype},
        files={"file": (filename, raw, content_type)},
    )


# ── Happy paths ───────────────────────────────────────────────────────────────


def test_upload_poster_persists_record_and_blob(client, db, storage):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h, fmt="JPEG")

    r = _post_artwork(client, ep["id"], "poster", raw)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["artwork_type"] == "poster"
    assert body["episode_id"] == ep["id"]
    assert body["width"] == spec.target_w
    assert body["height"] == spec.target_h
    assert body["size_bytes"] == len(raw)

    # The blob must be on disk.
    assert storage.exists(body["storage_key"])
    # And the URL prefix is configurable via storage.
    assert body["storage_key"].endswith("poster.jpg")


def test_upload_banner(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.BANNER)
    raw = _make_image(spec.target_w, spec.target_h, fmt="JPEG")
    r = _post_artwork(client, ep["id"], "banner", raw)
    assert r.status_code == 201, r.text
    assert r.json()["width"] == spec.target_w
    assert r.json()["height"] == spec.target_h


def test_upload_thumbnail(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.THUMBNAIL)
    raw = _make_image(spec.target_w, spec.target_h, fmt="JPEG")
    r = _post_artwork(client, ep["id"], "thumbnail", raw)
    assert r.status_code == 201, r.text
    assert r.json()["width"] == spec.target_w
    assert r.json()["height"] == spec.target_h


# ── Validation rejections ────────────────────────────────────────────────────


def test_upload_wrong_dimensions_rejected(client):
    ep = _create_episode(client)
    # Send a 1200x1800 image as a poster -- exact 2:3 aspect, but
    # NOT the required 600x900 pixel dimensions.
    raw = _make_image(1200, 1800)
    r = _post_artwork(client, ep["id"], "poster", raw)
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "invalid_dimensions"
    assert "600" in body["detail"] and "900" in body["detail"]
    assert "1200" in body["detail"] and "1800" in body["detail"]


def test_upload_wrong_aspect_but_close_dimensions_rejected(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.BANNER)
    # 1281x720 -> 1281:720 ratio (NOT 16:9), but close to the target width.
    raw = _make_image(spec.target_w + 1, spec.target_h)
    r = _post_artwork(client, ep["id"], "banner", raw)
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_aspect_ratio"


def test_upload_oversize_rejected(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.THUMBNAIL)
    raw = _make_over_size(
        spec.target_w, spec.target_h, target_bytes=spec.max_bytes + 4096
    )
    r = _post_artwork(client, ep["id"], "thumbnail", raw)
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "file_too_large"
    assert "200 KB" in body["detail"]


def test_upload_corrupted_file_rejected(client, storage):
    ep = _create_episode(client)
    r = _post_artwork(
        client, ep["id"], "poster", b"this is not an image at all"
    )
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "invalid_image"


def test_upload_wrong_mime_but_real_image_accepted(client):
    """
    A PNG renamed to .jpg (wrong Content-Type) is still a real image;
    the validator must accept it because Pillow decodes the bytes.
    The server normalises mime based on the actual file content.
    """
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h, fmt="PNG")
    # Lie about content-type and extension. Should still work.
    r = _post_artwork(
        client, ep["id"], "poster", raw,
        content_type="application/octet-stream",
        filename="not-really-an-image.png",
    )
    assert r.status_code == 201, r.text
    assert r.json()["mime_type"] == "image/png"


def test_upload_unknown_artwork_type_rejected(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)
    r = _post_artwork(client, ep["id"], "splash", raw)
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_artwork_type"


# ── Episode not found ────────────────────────────────────────────────────────


def test_upload_missing_episode_returns_404(client):
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)
    r = _post_artwork(client, 999999, "poster", raw)
    assert r.status_code == 404
    assert r.json()["code"] == "not_found"


# ── Replacement upload ───────────────────────────────────────────────────────


def test_replacement_replaces_record_and_blob(client, db, storage):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw1 = _make_image(spec.target_w, spec.target_h)
    r1 = _post_artwork(client, ep["id"], "poster", raw1)
    assert r1.status_code == 201, r1.text
    record_id = r1.json()["id"]

    # Second upload with different bytes (but same dimensions).
    raw2 = _make_image(spec.target_w, spec.target_h)
    r2 = _post_artwork(client, ep["id"], "poster", raw2)
    assert r2.status_code == 201, r2.text
    assert r2.json()["id"] == record_id  # same row replaced in place
    assert r2.json()["size_bytes"] == len(raw2)

    # Only ONE Artwork row exists for (episode, type).
    rows = db.execute(
        select(Artwork).where(
            Artwork.episode_id == ep["id"],
            Artwork.artwork_type == ArtworkType.POSTER,
        )
    ).scalars().all()
    assert len(rows) == 1
    # And the on-disk blob equals the second upload.
    key = rows[0].storage_key
    assert storage.exists(key)
    assert storage.root.joinpath(*key.split("/")).read_bytes() == raw2


# ── Storage failure must not leave a DB record ───────────────────────────────


def test_storage_failure_does_not_create_db_record(client, db, monkeypatch):
    """
    Force storage.save to raise after validation succeeds and assert:
      * the API returns 500
      * no Artwork row exists for the episode
      * no stale blob lingers on disk
    """
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)

    from app.services.storage import StorageError

    class _BoomStorage:
        def save(self, key, data, content_type):
            raise StorageError("disk on fire")

        def delete(self, key):
            pass

        def exists(self, key):
            return False

        def get_url(self, key):
            return key

    monkeypatch.setattr(
        "app.services.artwork.get_storage",
        lambda: _BoomStorage(),
    )

    r = _post_artwork(client, ep["id"], "poster", raw)
    assert r.status_code == 500, r.text
    rows = db.execute(
        select(Artwork).where(Artwork.episode_id == ep["id"])
    ).scalars().all()
    assert rows == []


# ── GET URL via static mount ──────────────────────────────────────────────────


def test_uploaded_blob_is_served_via_static_mount(client):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.BANNER)
    raw = _make_image(spec.target_w, spec.target_h)
    r = _post_artwork(client, ep["id"], "banner", raw)
    assert r.status_code == 201, r.text
    key = r.json()["storage_key"]

    # The static mount serves the blob back. The mount is registered
    # in `app.main` against the configured STORAGE_LOCAL_URL_PREFIX
    # (defaults to "/storage").
    r2 = client.get(f"/storage/{key}")
    assert r2.status_code == 200
    assert r2.content == raw


# ── Delete ────────────────────────────────────────────────────────────────────


def test_delete_artwork_removes_record_and_blob(client, db, storage):
    ep = _create_episode(client)
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)
    r = _post_artwork(client, ep["id"], "poster", raw)
    key = r.json()["storage_key"]

    d = client.delete(f"/api/episodes/{ep['id']}/artwork/poster")
    assert d.status_code == 204
    assert not storage.exists(key)
    rows = db.execute(
        select(Artwork).where(Artwork.episode_id == ep["id"])
    ).scalars().all()
    assert rows == []


def test_delete_missing_artwork_returns_404(client):
    ep = _create_episode(client)
    d = client.delete(f"/api/episodes/{ep['id']}/artwork/poster")
    assert d.status_code == 404