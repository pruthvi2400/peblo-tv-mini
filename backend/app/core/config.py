from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database configuration
    DATABASE_URL: str = Field(
        default="postgresql://user:password@localhost:5432/peblo_tv",
        description="PostgreSQL database connection string"
    )
    # Optional SQLite override used by the test suite.
    # When set, the API / test fixtures will create a SQLite engine instead
    # of the PostgreSQL one. Never set this in production.
    TEST_DATABASE_URL: str | None = Field(
        default=None,
        description="Optional SQLite URL for tests (overrides DATABASE_URL)."
    )

    # ── Phase 5: JWT / authentication configuration ─────────────────────────
    # The JWT secret MUST be supplied via environment in any non-test
    # deployment. A development-only default is provided so the local
    # API can boot without a .env file, but tests ALWAYS override it
    # via a known fixture value.
    JWT_SECRET_KEY: str = Field(
        default="dev-only-do-not-use-in-production-please",
        description=(
            "Secret key used to sign access tokens. Must be set from the "
            "environment in production. Never commit a real secret."
        ),
    )
    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="Algorithm for signing access tokens.",
    )
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60,
        ge=1,
        description="Access token lifetime in minutes.",
    )
    # When False (the default) the API will refuse to seed dev users
    # in production. Flip on locally with DEV_SEED_USERS=true.
    DEV_SEED_USERS: bool = Field(
        default=False,
        description=(
            "When True, ensure_dev_seed_users() upserts the editor/admin "
            "accounts sourced from DEV_*_EMAIL / DEV_*_PASSWORD. MUST "
            "remain False in production."
        ),
    )
    DEV_EDITOR_EMAIL: str | None = Field(
        default=None,
        description="Email of the development-only editor user.",
    )
    DEV_EDITOR_PASSWORD: str | None = Field(
        default=None,
        description="Password of the development-only editor user.",
    )
    DEV_ADMIN_EMAIL: str | None = Field(
        default=None,
        description="Email of the development-only admin user.",
    )
    DEV_ADMIN_PASSWORD: str | None = Field(
        default=None,
        description="Password of the development-only admin user.",
    )

    # Server configuration
    HOST: str = Field(
        default="0.0.0.0",
        description="Server host"
    )

    PORT: int = Field(
        default=8000,
        description="Server port"
    )

    # Logging configuration
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level"
    )

    # ── Phase 4: storage configuration ─────────────────────────────────────
    # Selects the storage backend implementation. The default ("local")
    # writes blobs to the local filesystem so the dev / test environment
    # is fully self-contained. A production deployment (Phase 6+) is
    # expected to swap this for an R2 / S3 backend without touching any
    # API or service code -- see app.services.storage.
    STORAGE_BACKEND: str = Field(
        default="local",
        description=(
            "Storage backend name. 'local' writes under STORAGE_LOCAL_ROOT. "
            "Other values route to additional Storage implementations "
            "(e.g. 'r2') added in later phases."
        ),
    )
    STORAGE_LOCAL_ROOT: str = Field(
        default="./_storage",
        description=(
            "Filesystem root for the local storage backend. Created on "
            "first use if missing."
        ),
    )
    STORAGE_LOCAL_URL_PREFIX: str = Field(
        default="/storage",
        description=(
            "URL prefix served by the local-storage static mount in "
            "development. The returned URL is <prefix>/<key>."
        ),
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False
    }

settings = Settings()