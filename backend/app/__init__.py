"""
Peblo TV Mini backend application.

Importing this package registers all SQLAlchemy models with Base.metadata.
To run the API: uvicorn app.main:app
"""

# Import all models so they are registered with SQLAlchemy Base.metadata.
# This ensures Alembic's autogenerate sees all tables and
# Base.metadata.create_all() creates all tables.
from app import models  # noqa: F401
