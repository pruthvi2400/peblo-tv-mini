"""
Pytest fixtures.

Each test runs against a fresh in-memory SQLite database with a single
shared connection (StaticPool) so multiple sessions in the same test
see the same tables.

The FastAPI app's `get_db` dependency is overridden to yield sessions
bound to the test engine.

Phase 5 adds authentication fixtures (`editor_user`, `admin_user`,
`editor_token`, `admin_token`, `auth_client`) without changing the
existing fixtures so the Phase 1-4 tests still run unmodified.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure tests don't try to connect to PostgreSQL.
os.environ.setdefault("TEST_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
# Pin a stable JWT secret for tests so token round-trips are
# deterministic. (Settings reloads on import; we set it BEFORE the
# app modules are imported.)
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production")
os.environ.setdefault("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "5")

# Import after env vars are set so the engine picks up SQLite.
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.db import base as db_base  # noqa: E402
from app.db import session as db_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services.auth import (  # noqa: E402
    AuthError,
    authenticate as auth_authenticate,
)


# ─── Per-test SQLite engine ──────────────────────────────────────────────────
@pytest.fixture()
def engine() -> Iterator[Engine]:
    """A fresh in-memory SQLite engine with schema created.

    Uses StaticPool so every connection in the test reuses the same
    in-memory database — without this, each new connection would get
    its own private DB and tables created on one connection would be
    invisible to others.
    """
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enforce FK cascades in SQLite.
    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    db_base.Base.metadata.create_all(bind=eng)
    try:
        yield eng
    finally:
        eng.dispose()


@pytest.fixture()
def db_session_factory(engine: Engine):
    """A session factory bound to the test engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db(db_session_factory) -> Iterator[Session]:
    """A single SQLAlchemy session with cleanup at end of test."""
    session = db_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session_factory) -> Iterator[TestClient]:
    """
    FastAPI TestClient wired to the test database.

    Overrides `get_db` so request handlers use the same session
    factory as the rest of the test fixtures.

    No auth override is installed here. The Phase 1-4 tests that use
    this fixture will now hit 401 on every CRUD call because those
    endpoints require a bearer token in Phase 5. To keep those tests
    working we install a default `get_current_user` override that
    returns an in-memory editor -- see `editor_user` and the helper
    `_install_default_editor_override()` below.
    """

    def _get_db_override():
        s = db_session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[db_session.get_db] = _get_db_override

    # Phase 5: Phase 1-4 tests assume CRUD is reachable without auth.
    # We synthesise a transient editor user and override the auth
    # dependency so those tests continue to pass unmodified.
    from app.api.deps import get_current_user

    transient = User(
        email="phase4.transient@peblo.local",
        password_hash="unused-by-override",
        role=UserRole.EDITOR,
    )

    def _override_current_user():
        return transient

    app.dependency_overrides[get_current_user] = _override_current_user

    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


# ─── Phase 5: authentication fixtures ─────────────────────────────────────────


# Reused by every test that wants to log in / mint tokens.
EDITOR_EMAIL = "editor.test@peblo.local"
EDITOR_PASSWORD = "editor-password-test"
ADMIN_EMAIL = "admin.test@peblo.local"
ADMIN_PASSWORD = "admin-password-test"


def _make_user(db: Session, *, email: str, password: str, role: UserRole) -> User:
    """Insert a fully-provisioned user with a fresh bcrypt hash."""
    from app.core.security import hash_password

    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def editor_user(db: Session) -> User:
    """An editor account persisted in the test DB."""
    return _make_user(
        db,
        email=EDITOR_EMAIL,
        password=EDITOR_PASSWORD,
        role=UserRole.EDITOR,
    )


@pytest.fixture()
def admin_user(db: Session) -> User:
    """An admin account persisted in the test DB."""
    return _make_user(
        db,
        email=ADMIN_EMAIL,
        password=ADMIN_PASSWORD,
        role=UserRole.ADMIN,
    )


def _issue_token(*, email: str, role: UserRole) -> str:
    return create_access_token(
        subject=email,
        extra_claims={"role": role.value},
    )


@pytest.fixture()
def editor_token(editor_user: User) -> str:
    """A signed access token for the editor account."""
    return _issue_token(email=editor_user.email, role=editor_user.role)


@pytest.fixture()
def admin_token(admin_user: User) -> str:
    """A signed access token for the admin account."""
    return _issue_token(email=admin_user.email, role=admin_user.role)


@pytest.fixture()
def auth_client(
    db_session_factory, editor_token: str, admin_token: str
) -> Iterator[TestClient]:
    """
    A TestClient that:
      * uses the per-test SQLite session factory via `get_db` override
      * can be driven by either the editor or admin bearer header
      * exposes `auth_headers(role)` so each call picks the right one

    This is the convenience fixture for the Phase-5 test modules. It
    does NOT install an auth dependency override -- the bearer header
    is the only auth path it accepts, so each test exercises the real
    /auth/login -> JWT -> get_current_user code path.
    """
    def _get_db_override():
        s = db_session_factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[db_session.get_db] = _get_db_override

    tokens = {"editor": editor_token, "admin": admin_token}

    class _AuthClient(TestClient):
        def auth_headers(self, role: str = "editor") -> dict[str, str]:
            return {"Authorization": f"Bearer {tokens[role]}"}

        # Convenience helpers -- terse on purpose so tests stay readable.
        def get_as(self, role: str, url: str, **kw):
            return self.get(url, headers=self.auth_headers(role), **kw)

        def post_as(self, role: str, url: str, **kw):
            return self.post(url, headers=self.auth_headers(role), **kw)

        def put_as(self, role: str, url: str, **kw):
            return self.put(url, headers=self.auth_headers(role), **kw)

        def delete_as(self, role: str, url: str, **kw):
            return self.delete(url, headers=self.auth_headers(role), **kw)

    try:
        with _AuthClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


# Re-export a few names that Phase-5 tests reach for so they can grab
# them straight from `tests.conftest` without a separate import line.
__all__ = [
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "AuthError",
    "EDITOR_EMAIL",
    "EDITOR_PASSWORD",
    "User",
    "UserRole",
    "auth_authenticate",
    "settings",
]