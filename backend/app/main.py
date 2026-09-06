"""
FastAPI application entry point.

Run:
    uvicorn app.main:app --reload

Routes registered here:
    GET  /                  - liveness home
    GET  /health            - health check
    /auth/login             - exchange email + password for a JWT
    /auth/me                - return the user behind the bearer token
    /api/shows              - show CRUD (editor or admin)
    /api/seasons            - season CRUD (editor or admin)
    /api/episodes           - episode CRUD (editor or admin)
    /api/episodes/{id}/artwork
                            - upload / delete episode artwork (editor or admin)
    /admin/validation-report
                            - publish-blocker report (editor or admin)
    /admin/catalog/publish  - placeholder (admin only, 501)
    <STORAGE_LOCAL_URL_PREFIX>/...
                            - local storage blob mount (Phase 4)
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.errors import register_error_handlers
from app.api import (
    admin_publish_router,
    admin_router,
    artwork_router,
    auth_router,
    catalog_router,
    episodes_router,
    seasons_router,
    shows_router,
)
from app.core.config import settings
from app.db.session import SessionLocal, engine


app = FastAPI(
    title="Peblo TV Mini API",
    description="Admin CRUD API for the Peblo TV Mini catalogue.",
    version="0.5.0",
)

# CORS — open in dev, restrict in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Map service-layer errors to HTTP responses.
register_error_handlers(app)


@app.get("/", tags=["meta"])
def home():
    return {"message": "Peblo TV Mini API is running"}


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


# ── Static mount for local storage blobs (Phase 4) ─────────────────────────
# The local storage backend writes under STORAGE_LOCAL_ROOT and the
# URLs it hands out are `<STORAGE_LOCAL_URL_PREFIX>/<key>`. We mount
# that prefix so the React CMS can `<img src=...>` them in dev.
_storage_root = Path(settings.STORAGE_LOCAL_ROOT).resolve()
_storage_root.mkdir(parents=True, exist_ok=True)
app.mount(
    settings.STORAGE_LOCAL_URL_PREFIX,
    StaticFiles(directory=str(_storage_root), check_dir=False),
    name="storage",
)


# Mount routers.
# Auth is mounted FIRST so it shows up at the top of the OpenAPI page.
app.include_router(auth_router)
app.include_router(shows_router)
app.include_router(seasons_router)
app.include_router(episodes_router)
app.include_router(artwork_router)
app.include_router(admin_router)
app.include_router(admin_publish_router)
app.include_router(catalog_router)


@app.on_event("startup")  # deprecated in modern FastAPI but still supported
def startup():
    # Best-effort: create tables if the DB supports it (Postgres / SQLite).
    # Migrations remain the canonical way to create tables in production.
    from app.db.base import Base
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Don't crash the API if the DB is unavailable at startup.
        pass

    # Phase 5: dev-only seed users. Activated when DEV_SEED_USERS=true
    # AND all four DEV_*_EMAIL / DEV_*_PASSWORD env vars are set. NEVER
    # enable this in production -- it rewrites the password hash on
    # every boot and relies on plaintext credentials.
    if settings.DEV_SEED_USERS:
        from app.services.auth import ensure_dev_seed_users

        try:
            ensure_dev_seed_users(SessionLocal())
        except Exception:
            # We don't want startup to crash if the dev seed can't run
            # (e.g. during tests where the user table may not yet have
            # the right columns). The first request that needs auth will
            # surface the failure clearly.
            pass