# Peblo TV Mini

A multi-tenant streaming platform admin system with viewer frontend.

## Quick Start

```bash
# Copy environment and start all services
cp .env.example .env
docker compose up --build

# Services will be available at:
# - Viewer: http://localhost:5174
# - CMS:    http://localhost:5173
# - API:    http://localhost:8000
# - Docs:   http://localhost:8000/docs
```

**Default credentials:** `admin@peblo.tv` / `admin123`

## Architecture

```
viewer/          # Public React frontend (reads from catalogue)
cms/             # Admin React CMS (manages shows/episodes)
backend/         # FastAPI REST API
docker-compose   # PostgreSQL + all services
```

## Key Features

### Atomic Publish
Catalogue changes are staged in `/_storage/catalogue/versions/` and atomically swapped to `live.json` via filesystem rename (atomic on POSIX). Only published shows/episodes appear in the viewer.

### Storage Abstraction
- **Dev/Local:** Filesystem under `/_storage/`
- **Production:** Cloudflare R2 (S3-compatible) with presigned URLs
- Switch via `STORAGE_BACKEND=r2` env var

### Pre-Published Catalogue
The viewer reads a static `live.json` (published catalogue), not live DB. Benefits:
- Zero viewer DB load
- Instant global replication via CDN
- Publisher controls exactly what viewers see
- Rollback by republishing previous version

### Search
Search is a database `ILIKE` query on the **published** catalogue only. Limitation: does not scale to millions of shows. Production would use:
- Elasticsearch/OpenSearch for full-text search
- Elasticsearch/OpenSearch syncing from `live.json`

## Health Endpoint

`GET /health` returns `{"status": "ok"}`. 

**Production alert:** Monitor `/health` returning non-200 OR latency > 2s. Alert threshold: 3 consecutive failures in 1 minute triggers PagerDuty/Slack.

## Omisions & Tradeoffs

| Decision | Rationale |
|----------|-----------|
| SQLite for tests | Fast, no DB dependency |
| `on_event("startup")` | Deprecated but functional; no time for rewrite |
| CORS `*` | Dev-only; restrict in production |
| No migrations in Docker | `create_all()` at startup; production uses Alembic |
| 2 pre-existing test failures | Known issues, not blocking |

## AI Tools Used

| Tool | Usage | Outcome |
|------|-------|---------|
| GitHub Copilot | Boilerplate code, comments | ACCEPTED |
| Claude Code | Architecture questions | ACCEPTED |
| ChatGPT | Debugging help | ACCEPTED/REJECTED (incorrect JWT claims) |

## Testing

```bash
# Backend
cd backend && python -m pytest tests/ -v

# CMS
cd cms && npm run test

# Viewer
cd viewer && npm run test

# Docker health check
curl http://localhost:8000/health
```

## Deployment

**Recommended production stack:**
- Managed PostgreSQL (RDS, Cloud SQL)
- Cloudflare R2 for artwork (S3-compatible, cheaper)
- Docker on ECS/Fargate or Kubernetes
- CloudFront CDN for viewer static assets
- Route53 + ACM for DNS/TLS

**Secrets required:**
- `JWT_SECRET_KEY` (32+ bytes)
- `DATABASE_URL` (managed DB)
- `R2_*` credentials (if using R2)

## Time Spent

Phase 9: ~2 hours (Docker, GitHub Actions, health endpoint, docs)

Total: ~40 hours across all phases
