"""
Alembic environment configuration.

Registers all SQLAlchemy models with Base.metadata so autogenerate
detects them.
"""

from logging.config import fileConfig
import sys
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure the backend root is on sys.path so `app.*` imports work
# when alembic is invoked from the backend/ directory.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Import your SQLAlchemy Base
from app.db.base import Base
from app.core.config import settings

# ─── IMPORTANT ───────────────────────────────────────────────────────────────
# Import all models so SQLAlchemy registers them with Base.metadata.
# This is what Alembic uses for autogenerate.
# ──────────────────────────────────────────────────────────────────────────────
from app import models  # noqa: F401  (imports all model classes)
# After this, Base.metadata has: users, shows, show_categories,
# seasons, episodes, artwork, publish_runs.

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# Use the default logging configuration
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the SQLAlchemy URL from the app settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# target_metadata = Base.metadata tells Alembic which metadata to compare against
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is also acceptable
    here alongside a URL, which however does not provide
    for database logon time.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


def run_migrations() -> None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()


if __name__ == "__main__":
    run_migrations()
