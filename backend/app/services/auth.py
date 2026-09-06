"""
Auth service: credential verification and dev-user seeding (Phase 5).

This module is the only place that:
  * looks up a User row by email and verifies a password against its
    bcrypt hash
  * creates the development-only editor / admin accounts sourced
    from environment variables

Password verification never logs or returns the plaintext password,
and `AuthError` is the only exception that escapes the service so
the API layer can translate it into a uniform 401 response.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.services.errors import ValidationFailure


logger = logging.getLogger(__name__)


# ── Errors ────────────────────────────────────────────────────────────────────


class AuthError(Exception):
    """Authentication failed (unknown user, wrong password, etc.).

    Carries a public-safe message; details never include the submitted
    credentials.
    """

    def __init__(self, message: str = "invalid credentials") -> None:
        super().__init__(message)
        self.message = message


# ── Credential verification ────────────────────────────────────────────────────


def get_user_by_email(db: Session, email: str) -> User | None:
    """Return the user with `email`, or None. Email is matched exactly."""
    return db.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()


def authenticate(db: Session, *, email: str, password: str) -> User:
    """
    Verify credentials and return the matching User row.

    Raises `AuthError` if the user does not exist, has no password set,
    or the password does not match. We deliberately return the same
    generic message in every failure case so the API does not act as
    a user-enumeration oracle.
    """
    user = get_user_by_email(db, email)
    if user is None:
        # Run a no-op hash to make timing more uniform between the
        # "no such user" and "wrong password" paths.
        verify_password(password, _dummy_hash())
        raise AuthError("Invalid email or credentials.")

    if user.password_hash is None or not user.password_hash:
        # Account was provisioned but never given a password.
        raise AuthError("Invalid email or credentials.")

    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or credentials.")

    return user


def _dummy_hash() -> str:
    """A throwaway bcrypt hash used only to keep auth latency uniform."""
    return "$2b$12$" + ("x" * 53)


# ── Dev user seeding ──────────────────────────────────────────────────────────


@dataclass
class DevSeedResult:
    editor_created: bool
    admin_created: bool
    editor_updated: bool
    admin_updated: bool


def ensure_dev_seed_users(db: Session) -> DevSeedResult | None:
    """
    Upsert the development editor / admin accounts.

    Activated ONLY when `DEV_SEED_USERS=true` AND both
    `DEV_EDITOR_EMAIL` + `DEV_EDITOR_PASSWORD` (and the admin pair)
    are set. Returns None when not active so the caller can log a
    "skipped" message without having to inspect every field.

    NEVER call this in production: it relies on plaintext passwords
    from the environment and rewrites them on every run.
    """
    if not settings.DEV_SEED_USERS:
        return None

    editor_email = settings.DEV_EDITOR_EMAIL
    editor_password = settings.DEV_EDITOR_PASSWORD
    admin_email = settings.DEV_ADMIN_EMAIL
    admin_password = settings.DEV_ADMIN_PASSWORD

    missing = [
        name
        for name, val in (
            ("DEV_EDITOR_EMAIL", editor_email),
            ("DEV_EDITOR_PASSWORD", editor_password),
            ("DEV_ADMIN_EMAIL", admin_email),
            ("DEV_ADMIN_PASSWORD", admin_password),
        )
        if not val
    ]
    if missing:
        raise ValidationFailure(
            (
                "DEV_SEED_USERS is enabled but the following env vars "
                f"are missing: {', '.join(missing)}. Refusing to seed "
                "a half-configured account set."
            ),
            code="dev_seed_users_incomplete",
            field="DEV_SEED_USERS",
        )

    # Email/password comparisons are case-sensitive; lower-case the
    # stored email so lookups behave predictably.
    editor_email = editor_email.strip()
    admin_email = admin_email.strip()

    editor = get_user_by_email(db, editor_email)
    editor_created = False
    editor_updated = False
    if editor is None:
        editor = User(
            email=editor_email,
            password_hash=hash_password(editor_password),
            role=UserRole.EDITOR,
        )
        db.add(editor)
        editor_created = True
    else:
        editor.password_hash = hash_password(editor_password)
        editor.role = UserRole.EDITOR
        editor_updated = True

    admin = get_user_by_email(db, admin_email)
    admin_created = False
    admin_updated = False
    if admin is None:
        admin = User(
            email=admin_email,
            password_hash=hash_password(admin_password),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        admin_created = True
    else:
        admin.password_hash = hash_password(admin_password)
        admin.role = UserRole.ADMIN
        admin_updated = True

    db.commit()

    logger.info(
        "Dev seed users ensured (editor=%s, admin=%s)",
        editor_email,
        admin_email,
    )

    return DevSeedResult(
        editor_created=editor_created,
        admin_created=admin_created,
        editor_updated=editor_updated,
        admin_updated=admin_updated,
    )


__all__ = [
    "AuthError",
    "DevSeedResult",
    "authenticate",
    "ensure_dev_seed_users",
    "get_user_by_email",
]