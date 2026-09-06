# Peblo TV Mini

A multi-tenant streaming platform with an admin CMS, a FastAPI backend with PostgreSQL, and a public viewer. Content editors manage shows/episodes; admins publish a frozen catalogue snapshot that the viewer reads. CMS React ? FastAPI/PostgreSQL ? publish pipeline ? catalogue.json ? Viewer React.

## Architecture

```
+---------+     +--------------+     +-------------+     +------------+
¦   CMS   ¦----?¦   FastAPI    ¦----?¦  PostgreSQL ¦     ¦  Viewer    ¦
¦ (React) ¦     ¦  Backend     ¦     +-------------+     ¦  (React)   ¦
+---------+     +--------------+                        +------?-----+
                       ¦                                       ¦
                       ¦  publish pipeline                     ¦
                       ?                                       ¦
                +--------------+                              ¦
                ¦ catalogue.json                              ¦
                ¦ (versions/)  ¦------------------------------+
                +--------------+
```

- **CMS**: React SPA for editors to manage shows, episodes, and artwork
- **Backend**: FastAPI with SQLAlchemy/PostgreSQL; handles auth (JWT), CRUD, publish pipeline, and search
- **Publish pipeline**: Builds catalogue in memory, writes versioned snapshot, atomically swaps live.json
- **Generated catalogue**: Static JSON consumed by the viewer; enables CDN caching and a clean viewer boundary
- **Viewer**: Public React SPA that reads only the published catalogue (never talks to the DB directly)
- **Storage abstraction**: `StorageBackend` interface with a local filesystem implementation; R2 swap via `STORAGE_BACKEND=r2` env var

## Key Design Decisions

### Atomic Publish

The publish endpoint builds a complete catalogue snapshot in memory from the database, writes it as a new versioned file (`/_storage/catalogue/versions/v{N}.json`), then uses `os.rename()` to atomically replace `live.json`. POSIX rename is atomic, so readers never see a partial catalogue. If the process crashes mid-write, the old `live.json` remains valid and unchanged.

### Artwork Storage

`StorageBackend` is an abstract interface with `upload`/`get_url`/`delete` methods. The local implementation stores files under `/_storage/` and serves them via a `/storage/` endpoint. The R2 implementation uses boto3 with presigned URLs. Current validation: dimensions check (max 4096×4096), aspect ratio (max 3:1), file size (max 200 KB). Switching to R2 requires only `STORAGE_BACKEND=r2` and R2 credentials; no code changes.

### Search

`GET /catalog/search` filters the published catalogue by `q` (title ILIKE), `category`, `language`, and `section` using Python string matching. This is appropriate for the challenge catalogue scale. At larger scale, search would use PostgreSQL full-text search indices or an external engine (OpenSearch/Elasticsearch) synced from `live.json`.

### Why a Published Catalogue

The viewer reads a pre-built `live.json` rather than querying the relational DB directly. This gives:
- Predictable read performance independent of DB load
- A simple, stable viewer boundary (static JSON, no API complexity)
- An atomic snapshot; changes are only visible after publish
- Easy rollback by republishing a previous version

Tradeoff: content changes require a publish step before viewers see them.

## Roles & Validation

- **Editor**: Can create/update/delete shows, episodes, and artwork through the CMS
- **Admin**: Full editor access plus the ability to publish a catalogue version
- Server-side enforcement: all role checks happen in the API layer, not the CMS
- Artwork validation (dimensions, aspect ratio, size) is enforced server-side before storage
- Publish validation ensures a well-formed catalogue before swapping `live.json`

## Running Locally

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Viewer  | http://localhost:5174 |
| CMS     | http://localhost:5173 |
| API     | http://localhost:8000 |
| Docs    | http://localhost:8000/docs |

**Default credentials:** `admin@peblo.tv` / `admin123`

Docker is the intended complete local environment. The `.env` file is pre-populated by `docker-compose.yml`; for local development outside Docker, set `VITE_API_BASE_URL` and `DATABASE_URL` accordingly.

## CI/CD & Operations

**GitHub Actions pipeline (`.github/workflows/ci.yml`)**
- Backend: pytest on the `backend/` directory
- CMS: typecheck, lint, build, and tests via npm
- Viewer: typecheck, lint, build, and tests via npm
- Docker build: builds all three images on push to main/master

**Health endpoint:** `GET /health` returns `{"status": "ok"}`. In production, monitor for non-200 or latency > 2s; alert on 3 consecutive failures.

**Deployment:** Images are built and tagged by CI. Production deployment is described in the CI workflow as a manual push to a registry followed by infrastructure provisioning (ECS/Fargate, Cloud Run, or Kubernetes). Managed PostgreSQL, S3/R2 storage, CDN for static assets, and TLS termination via load balancer are recommended.

## Known Limitations / Omissions

| Item | Note |
|------|------|
| Local storage only | `STORAGE_BACKEND=local` is active; R2 is not wired up |
| Search scale | ILIKE matching on `live.json`; unsuitable for catalogues with millions of entries |
| CORS | Permissive `*` in dev; restrict in production |
| Migrations | `create_all()` at startup; production should use Alembic |
| Deployment | Docker images are built but not pushed or deployed to a live host |

## AI Assistance

AI tools (GitHub Copilot, Claude Code) were used during implementation for boilerplate generation, architecture discussion, and debugging. Useful suggestions were accepted after review and testing. Suggestions that conflicted with challenge requirements or actual code behavior were rejected or corrected.

## Verification

| Check | Status |
|-------|--------|
| Backend tests | Passing |
| CMS tests / typecheck / lint / build | Passing |
| Viewer tests / typecheck / lint / build | Passing |
| GitHub Actions (all jobs) | Passing |
