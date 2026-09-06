"""SQLAlchemy engine + session factory.

The default URL comes from `app.core.config.settings.DATABASE_URL`. Tests
may override the engine URL at import time by setting
`TEST_DATABASE_URL` in the environment *before* importing this module,
or by reassigning `engine` / `SessionLocal` in a test fixture.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.engine import Engine

from app.core.config import settings


def _make_engine() -> Engine:
    url = settings.TEST_DATABASE_URL or settings.DATABASE_URL
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    return create_engine(
        url,
        pool_pre_ping=True,
        echo=False,
        connect_args=connect_args,
    )


engine: Engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
