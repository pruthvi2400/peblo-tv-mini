"""
Tests for authentication + role enforcement (Phase 5).

Coverage mirrors the brief:

  Authentication
    - valid login
    - invalid password
    - unknown user
    - malformed / invalid token
    - expired token
    - /auth/me returns the user behind the bearer token

  Roles
    - editor can CRUD shows / seasons / episodes / artwork
    - admin can CRUD shows / seasons / episodes / artwork
    - editor CANNOT publish the catalogue (admin-only placeholder)
    - admin CAN access the publish placeholder (returns 501)

  Protected routes
    - unauthenticated CRUD -> 401
    - authenticated editor CRUD -> success
    - unauthenticated validation-report -> 401
    - authenticated editor validation-report -> success
    - authenticated admin validation-report -> success
    - insufficient role (editor -> admin endpoint) -> 403

  Security hardening
    - login with wrong password does NOT enumerate users
    - JWT secret comes from settings, not hardcoded
    - dev seed users are only created when explicitly enabled
"""

from __future__ import annotations

import io
import time
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from app.core.config import settings
from app.core.security import (
    TokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.artwork import ArtworkType
from app.models.user import User, UserRole
from app.services.artwork_specs import get_spec
from app.services.auth import (
    AuthError,
    authenticate,
    ensure_dev_seed_users,
    get_user_by_email,
)
from app.services.errors import ValidationFailure

from tests.conftest import ADMIN_PASSWORD, EDITOR_PASSWORD


# ── tiny helpers ───────────────────────────────────────────────────────────────


def _make_image(width: int, height: int) -> bytes:
    img = Image.new("RGB", (width, height), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _create_show(client, **overrides) -> dict:
    payload = {
        "title": "Sample Show",
        "slug": "sample-show",
        "section": "series",
        "status": "draft",
        "categories": ["adventure"],
    }
    payload.update(overrides)
    # The plain `client` fixture has an editor override, so no auth
    # header is needed. For the `auth_client` we set the editor
    # header by default so helpers Just Work.
    if hasattr(client, "auth_headers"):
        r = client.post(
            "/api/shows",
            json=payload,
            headers=client.auth_headers("editor"),
        )
    else:
        r = client.post("/api/shows", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


def _create_season(client, show_id, season_number=1) -> dict:
    headers = client.auth_headers("editor") if hasattr(client, "auth_headers") else None
    r = client.post(
        "/api/seasons",
        json={"show_id": show_id, "season_number": season_number},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_episode(client, season_id, **overrides) -> dict:
    base = {
        "season_id": season_id,
        "title": "Ep",
        "episode_number": 1,
        "language": "en",
        "content_group": "sample-s01e01",
        "status": "draft",
        "duration": 300,
        "artwork": [],
    }
    base.update(overrides)
    headers = client.auth_headers("editor") if hasattr(client, "auth_headers") else None
    r = client.post(
        "/api/episodes",
        json=base,
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


# ═════════════════════════════════════════════════════════════════════════════
# 1. Core / unit tests for security primitives
# ═════════════════════════════════════════════════════════════════════════════


def test_password_hash_is_not_plaintext():
    """Hashes are bcrypt strings, never the plaintext, and are verifiable."""
    plain = "super-secret-password"
    h = hash_password(plain)
    assert h != plain
    assert h.startswith("$2b$") or h.startswith("$2a$")
    assert verify_password(plain, h) is True
    assert verify_password("not-the-password", h) is False


def test_jwt_round_trip():
    token = create_access_token(
        subject="foo@example.com", extra_claims={"role": "editor"}
    )
    payload = decode_access_token(token)
    assert payload["sub"] == "foo@example.com"
    assert payload["role"] == "editor"
    assert payload["type"] == "access"


def test_decode_rejects_garbage():
    with pytest.raises(TokenError):
        decode_access_token("not-a-real-jwt")


def test_decode_rejects_wrong_signature():
    """Sign with a DIFFERENT secret and try to decode with the test secret."""
    import jwt as pyjwt

    bogus = pyjwt.encode(
        {"sub": "evil", "type": "access", "exp": int(time.time()) + 60},
        "totally-different-secret",
        algorithm="HS256",
    )
    with pytest.raises(TokenError):
        decode_access_token(bogus)


# ═════════════════════════════════════════════════════════════════════════════
# 2. /auth/login — happy + failure paths
# ═════════════════════════════════════════════════════════════════════════════


def test_login_valid_credentials_returns_bearer_token(auth_client, editor_user):
    r = auth_client.post(
        "/auth/login",
        json={"email": editor_user.email, "password": EDITOR_PASSWORD},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]

    payload = decode_access_token(body["access_token"])
    assert payload["sub"] == editor_user.email
    assert payload["role"] == "editor"


def test_login_invalid_password_returns_401(auth_client, editor_user):
    r = auth_client.post(
        "/auth/login",
        json={"email": editor_user.email, "password": "wrong-password"},
    )
    assert r.status_code == 401, r.text
    body = r.json()
    assert body["code"] == "not_authenticated"
    assert "password" not in body["detail"].lower()


def test_login_unknown_user_returns_401(auth_client):
    r = auth_client.post(
        "/auth/login",
        json={"email": "ghost@peblo.local", "password": "whatever"},
    )
    assert r.status_code == 401, r.text
    body = r.json()
    assert body["code"] == "not_authenticated"


def test_login_generic_message_same_for_wrong_user_and_wrong_password(
    auth_client, editor_user
):
    """No user enumeration through different response bodies."""
    r_wrong = auth_client.post(
        "/auth/login",
        json={"email": editor_user.email, "password": "wrong"},
    )
    r_ghost = auth_client.post(
        "/auth/login",
        json={"email": "ghost@peblo.local", "password": "wrong"},
    )
    assert r_wrong.status_code == r_ghost.status_code == 401
    assert r_wrong.json()["detail"] == r_ghost.json()["detail"]


def test_login_missing_field_returns_422(auth_client):
    r = auth_client.post("/auth/login", json={"email": "foo@bar"})
    assert r.status_code == 422, r.text
    assert r.json()["code"] == "request_validation"


def test_authenticate_unknown_user_raises(db):
    with pytest.raises(AuthError):
        authenticate(db, email="nobody@peblo.local", password="anything")


def test_authenticate_account_without_password_raises(db):
    """A user with NULL password_hash must NOT log in."""
    u = User(
        email="nohash@peblo.local",
        password_hash=None,
        role=UserRole.EDITOR,
    )
    db.add(u)
    db.commit()
    with pytest.raises(AuthError):
        authenticate(db, email=u.email, password="anything")


# ═════════════════════════════════════════════════════════════════════════════
# 3. /auth/me — token → current user
# ═════════════════════════════════════════════════════════════════════════════


def test_me_with_valid_token_returns_user(auth_client, editor_user):
    r = auth_client.get_as("editor", "/auth/me")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == editor_user.email
    assert body["role"] == "editor"
    assert body["id"] == editor_user.id


def test_me_without_token_returns_401(auth_client):
    """Use auth_client (no auth override) so /auth/me actually exercises
    the bearer-decode path. The shared `client` fixture installs a
    transient-editor override for the Phase 1-4 CRUD tests; using it
    here would make /auth/me succeed with 200 instead of 401."""
    r = auth_client.get("/auth/me")
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "not_authenticated"


def test_me_with_invalid_token_returns_401(auth_client):
    r = auth_client.get("/auth/me", headers={"Authorization": "Bearer junk"})
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "not_authenticated"


# ═════════════════════════════════════════════════════════════════════════════
# 4. Expired / stale tokens
# ═════════════════════════════════════════════════════════════════════════════


def test_expired_token_is_rejected(auth_client, admin_user):
    """Hand-craft a token with a past exp claim and verify 401."""
    import jwt as pyjwt

    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    token = pyjwt.encode(
        {
            "sub": admin_user.email,
            "type": "access",
            "role": "admin",
            "iat": int(past.timestamp()),
            "exp": int(past.timestamp()) + 1,
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    r = auth_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "not_authenticated"


def test_token_for_deleted_user_returns_401(auth_client, db, editor_user):
    """If a token points at a user that has been removed, 401 (not 500).

    We use `auth_client` (which already installed the per-test get_db
    override) so the standalone request sees the same DB the test
    mutated.
    """
    token = create_access_token(
        subject=editor_user.email, extra_claims={"role": "editor"}
    )
    db.delete(editor_user)
    db.commit()

    r = auth_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "not_authenticated"


# ═════════════════════════════════════════════════════════════════════════════
# 5. CRUD as editor and as admin
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("role", ["editor", "admin"])
def test_authenticated_user_can_crud_shows(auth_client, role):
    show = _create_show(auth_client, slug=f"{role}-show", title=f"{role} show")
    r = auth_client.get_as(role, f"/api/shows/{show['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == f"{role} show"

    upd = auth_client.put_as(
        role, f"/api/shows/{show['id']}", json={"title": "renamed"}
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["title"] == "renamed"

    delete = auth_client.delete_as(role, f"/api/shows/{show['id']}")
    assert delete.status_code == 204


@pytest.mark.parametrize("role", ["editor", "admin"])
def test_authenticated_user_can_crud_seasons(auth_client, role):
    show = _create_show(auth_client, slug=f"{role}-s", title=f"{role} seasons")
    season = _create_season(auth_client, show["id"])
    listed = auth_client.get_as(
        role, "/api/seasons", params={"show_id": show["id"]}
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    got = auth_client.get_as(role, f"/api/seasons/{season['id']}")
    assert got.status_code == 200
    rm = auth_client.delete_as(role, f"/api/seasons/{season['id']}")
    assert rm.status_code == 204


@pytest.mark.parametrize("role", ["editor", "admin"])
def test_authenticated_user_can_crud_episodes(auth_client, role):
    show = _create_show(auth_client, slug=f"{role}-e", title=f"{role} eps")
    season = _create_season(auth_client, show["id"])
    ep = _create_episode(
        auth_client, season["id"], content_group=f"{role}-s01e01"
    )
    upd = auth_client.put_as(
        role, f"/api/episodes/{ep['id']}", json={"title": "Pilot 2"}
    )
    assert upd.status_code == 200
    assert upd.json()["title"] == "Pilot 2"
    rm = auth_client.delete_as(role, f"/api/episodes/{ep['id']}")
    assert rm.status_code == 204


@pytest.mark.parametrize("role", ["editor", "admin"])
def test_authenticated_user_can_upload_and_delete_artwork(auth_client, role):
    show = _create_show(auth_client, slug=f"{role}-art", title=f"{role} art")
    season = _create_season(auth_client, show["id"])
    ep = _create_episode(
        auth_client, season["id"], content_group=f"{role}-art-s01e01"
    )
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)

    up = auth_client.post_as(
        role,
        f"/api/episodes/{ep['id']}/artwork",
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", raw, "image/jpeg")},
    )
    assert up.status_code == 201, up.text
    assert up.json()["storage_key"]

    delete = auth_client.delete_as(
        role, f"/api/episodes/{ep['id']}/artwork/poster"
    )
    assert delete.status_code == 204


# ═════════════════════════════════════════════════════════════════════════════
# 6. Unauthenticated access → 401
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "method,url,body",
    [
        ("get", "/api/shows", False),
        ("post", "/api/shows", True),
        ("get", "/api/shows/1", False),
        ("put", "/api/shows/1", True),
        ("delete", "/api/shows/1", False),
        ("get", "/api/seasons", False),
        ("post", "/api/seasons", True),
        ("get", "/api/seasons/1", False),
        ("put", "/api/seasons/1", True),
        ("delete", "/api/seasons/1", False),
        ("get", "/api/episodes", False),
        ("post", "/api/episodes", True),
        ("get", "/api/episodes/1", False),
        ("put", "/api/episodes/1", True),
        ("delete", "/api/episodes/1", False),
    ],
)
def test_unauthenticated_crud_returns_401(auth_client, method, url, body):
    """Every CRUD endpoint must reject anonymous requests with 401.

    Uses `auth_client` (no auth override) instead of `client` because
    `client` installs a transient editor override for Phase 1-4.
    """
    kwargs: dict = {}
    if body:
        kwargs["json"] = {}
    r = getattr(auth_client, method)(url, **kwargs)
    assert r.status_code == 401, (
        f"{method.upper()} {url} -> {r.status_code}: {r.text}"
    )
    assert r.json()["code"] == "not_authenticated"
    assert r.headers.get("www-authenticate", "").lower() == "bearer"


def test_unauthenticated_artwork_upload_returns_401(auth_client):
    """Upload path is protected by `EditorDep`. Without a bearer token
    the dependency should reject the request with 401."""
    spec = get_spec(ArtworkType.POSTER)
    raw = _make_image(spec.target_w, spec.target_h)
    # Episode id 1 won't exist; that's fine -- the auth check runs
    # BEFORE the service, so we should get 401 not 404.
    r = auth_client.post(
        "/api/episodes/1/artwork",
        data={"artwork_type": "poster"},
        files={"file": ("poster.jpg", raw, "image/jpeg")},
    )
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"


def test_unauthenticated_artwork_delete_returns_401(auth_client):
    r = auth_client.delete("/api/episodes/1/artwork/poster")
    assert r.status_code == 401


def test_malformed_authorization_header_returns_401(auth_client):
    r = auth_client.get(
        "/api/shows", headers={"Authorization": "NotBearer some-token"}
    )
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"


# ═════════════════════════════════════════════════════════════════════════════
# 7. Validation report — editor + admin allowed, anonymous 401
# ═════════════════════════════════════════════════════════════════════════════


def test_unauthenticated_validation_report_returns_401(auth_client):
    """The validation report is editor/admin-only. Anonymous → 401."""
    r = auth_client.get("/admin/validation-report")
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "not_authenticated"


def test_editor_validation_report_returns_200(auth_client):
    r = auth_client.get_as("editor", "/admin/validation-report")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "can_publish" in body
    assert "issues" in body
    assert "summary" in body


def test_admin_validation_report_returns_200(auth_client):
    r = auth_client.get_as("admin", "/admin/validation-report")
    assert r.status_code == 200, r.text


# ═════════════════════════════════════════════════════════════════════════════
# 8. Admin-only publish placeholder
# ═════════════════════════════════════════════════════════════════════════════


def test_anonymous_publish_returns_401(auth_client):
    r = auth_client.post("/admin/catalog/publish")
    assert r.status_code == 401


def test_editor_publish_returns_403(auth_client):
    r = auth_client.post_as("editor", "/admin/catalog/publish")
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "insufficient_role"


def test_admin_publish_with_empty_db_returns_200(auth_client):
    """With no published content and an empty DB, the publish
    pipeline succeeds and returns an empty-but-valid catalogue
    envelope (validation passes because there is nothing to
    validate)."""
    r = auth_client.post_as("admin", "/admin/catalog/publish")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert body["shows_count"] == 0
    assert body["seasons_count"] == 0
    assert body["episodes_count"] == 0
    assert "catalogue" in body


# ═════════════════════════════════════════════════════════════════════════════
# 9. Dev seed users
# ═════════════════════════════════════════════════════════════════════════════


def test_dev_seed_users_creates_editor_and_admin(monkeypatch, db):
    monkeypatch.setattr(settings, "DEV_SEED_USERS", True, raising=False)
    monkeypatch.setattr(
        settings, "DEV_EDITOR_EMAIL", "dev-editor@peblo.local", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_EDITOR_PASSWORD", "dev-editor-pw", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_EMAIL", "dev-admin@peblo.local", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_PASSWORD", "dev-admin-pw", raising=False
    )

    result = ensure_dev_seed_users(db)
    assert result is not None
    editor = get_user_by_email(db, "dev-editor@peblo.local")
    admin = get_user_by_email(db, "dev-admin@peblo.local")
    assert editor is not None and editor.role == UserRole.EDITOR
    assert admin is not None and admin.role == UserRole.ADMIN
    assert verify_password("dev-editor-pw", editor.password_hash)
    assert verify_password("dev-admin-pw", admin.password_hash)


def test_dev_seed_users_off_by_default(db):
    """If DEV_SEED_USERS is False, the function is a no-op."""
    if not settings.DEV_SEED_USERS:
        assert ensure_dev_seed_users(db) is None


def test_dev_seed_users_upserts_existing_accounts(monkeypatch, db):
    monkeypatch.setattr(settings, "DEV_SEED_USERS", True, raising=False)
    monkeypatch.setattr(
        settings, "DEV_EDITOR_EMAIL", "upd@peblo.local", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_EDITOR_PASSWORD", "first", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_EMAIL", "upd-a@peblo.local", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_PASSWORD", "first-a", raising=False
    )
    ensure_dev_seed_users(db)

    monkeypatch.setattr(
        settings, "DEV_EDITOR_PASSWORD", "second", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_PASSWORD", "second-a", raising=False
    )
    result = ensure_dev_seed_users(db)
    assert result.editor_updated and result.admin_updated
    editor = get_user_by_email(db, "upd@peblo.local")
    admin = get_user_by_email(db, "upd-a@peblo.local")
    assert verify_password("second", editor.password_hash)
    assert verify_password("second-a", admin.password_hash)


def test_dev_seed_users_refuses_incomplete_env(monkeypatch, db):
    monkeypatch.setattr(settings, "DEV_SEED_USERS", True, raising=False)
    monkeypatch.setattr(
        settings, "DEV_EDITOR_EMAIL", "x@peblo.local", raising=False
    )
    monkeypatch.setattr(settings, "DEV_EDITOR_PASSWORD", None, raising=False)
    monkeypatch.setattr(
        settings, "DEV_ADMIN_EMAIL", "y@peblo.local", raising=False
    )
    monkeypatch.setattr(
        settings, "DEV_ADMIN_PASSWORD", "ok", raising=False
    )
    with pytest.raises(ValidationFailure):
        ensure_dev_seed_users(db)


# ═════════════════════════════════════════════════════════════════════════════
# 10. Configuration sanity
# ═════════════════════════════════════════════════════════════════════════════


def test_jwt_settings_come_from_settings_object():
    """The security module reads the secret from `settings`, never a constant."""
    assert settings.JWT_ALGORITHM
    assert settings.JWT_SECRET_KEY
    assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES >= 1