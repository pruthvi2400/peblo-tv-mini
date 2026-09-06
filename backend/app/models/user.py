"""
User model for authentication and authorization.
"""

import enum

from sqlalchemy import String, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.db.base import Base


class UserRole(str, enum.Enum):
    """
    User roles for access control.

    - editor: can manage shows, seasons, episodes, and artwork.
    - admin: full access including user management and publishing.
    """

    EDITOR = "editor"
    ADMIN = "admin"


class User(TimestampMixin, Base):
    """
    User account for the Peblo TV admin system.

    Attributes:
        id: Primary key.
        email: Unique email address used for login.
        password_hash: Bcrypt/scrypt hash of the user's password.
            NULL when auth is not yet configured.
        role: Authorization role determining permissions.
        created_at: When the account was created.
        updated_at: When the account was last modified.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        doc="Unique email address for login.",
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Bcrypt/scrypt hash of the user's password. NULL until auth is set up.",
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", create_constraint=True),
        nullable=False,
        default=UserRole.EDITOR,
        doc="Authorization role (editor or admin).",
    )

    # ─── Relationships ────────────────────────────────────────────────────────

    publish_runs: Mapped[list["PublishRun"]] = relationship(
        back_populates="triggered_by_user",
        doc="Publish runs initiated by this user.",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email!r}, role={self.role})>"
