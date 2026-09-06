# Peblo TV Mini Backend

A FastAPI-based backend for the Peblo TV Mini application.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the database URL:

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```
DATABASE_URL=postgresql://user:password@localhost:5432/peblo_tv
```

### 3. Apply Migrations

```bash
alembic upgrade head
```

### 4. (Optional) Seed the Catalog

Phase 3 ships a one-shot loader for `tests/fixtures/seed_shows.json`:

```python
from app.db.session import SessionLocal
from app.services.seed import load_seed_shows

with SessionLocal() as s:
    result = load_seed_shows(s, r"tests/fixtures/seed_shows.json")
    print(result.to_dict())
```

The loader is idempotent: rerun it any time to refresh titles /
synopses / categories / artwork without creating duplicates.

### 5. Start the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

| Method | Path                       | Purpose                      |
| ------ | -------------------------- | ---------------------------- |
| GET    | `/`                        | Liveness                     |
| GET    | `/health`                  | Health check                 |
| GET    | `/api/shows`               | List shows (paginated)       |
| POST   | `/api/shows`               | Create a show                |
| GET    | `/api/shows/{id}`          | Retrieve a show              |
| PUT    | `/api/shows/{id}`          | Partial update               |
| DELETE | `/api/shows/{id}`          | Delete a show                |
| GET    | `/api/seasons`             | List seasons (paginated)     |
| POST   | `/api/seasons`             | Create a season              |
| GET    | `/api/seasons/{id}`        | Retrieve a season            |
| PUT    | `/api/seasons/{id}`        | Partial update               |
| DELETE | `/api/seasons/{id}`        | Delete a season              |
| GET    | `/api/episodes`            | List episodes (paginated)    |
| POST   | `/api/episodes`            | Create an episode            |
| GET    | `/api/episodes/{id}`       | Retrieve an episode          |
| PUT    | `/api/episodes/{id}`       | Partial update               |
| DELETE | `/api/episodes/{id}`       | Delete an episode            |
| POST   | `/api/episodes/{id}/artwork`             | Upload artwork (Phase 4)            |
| DELETE | `/api/episodes/{id}/artwork/{type}`      | Delete one artwork (Phase 4)        |
| GET    | `/admin/validation-report`               | Publish-blocker report (Phase 4)    |
| POST   | `/admin/catalog/publish`                 | Publish the catalogue (Phase 6, admin only) |
| GET    | `/admin/catalog/publish-runs`            | Publish-run history (Phase 6, editor/admin) |
| GET    | `/catalog`                               | Current published catalogue (Phase 6, public) |
| GET    | `/catalog/search`                        | Search the published catalogue (Phase 6, public) |

### Query / Filter Parameters

- `/api/shows`: `search` (title), `status`, `section`, `page`, `page_size`
- `/api/seasons`: `show_id`, `page`, `page_size`
- `/api/episodes`: `season_id`, `show_id`, `status`, `language`, `page`, `page_size`

### Pagination

All list endpoints accept `page` (default 1) and `page_size` (default
20, max 100). Response shape:

```json
{ "items": [...], "page": 1, "page_size": 20, "total": 47 }
```

### Validation Rules

- Show slug must be unique (`409 duplicate_slug`).
- `(show_id, season_number)` must be unique for seasons (`409 duplicate_season_number`).
- `(content_group, language)` must be unique for episodes (`409 duplicate_content_language`).
- `language` must be `en or `hi` (`422`).
- `section` must be one of `featured`, `series`, `minisodes`, `songs` (`422`).
- `categories` must be a subset of the 15 known categories (`422`).
- `duration` must be > 0 when supplied (`422`).
- A published show must have a `section` (`422`).
- A published episode must have a positive `duration` and all three
  artwork records (`poster`, `banner`, `thumbnail`) (`422 missing_duration` /
  `422 missing_artwork`).

### Artwork Upload (Phase 4)

`POST /api/episodes/{episode_id}/artwork` accepts a multipart upload
with two fields:

    artwork_type: "poster" | "banner" | "thumbnail"
    file:         the image bytes (the server opens it with Pillow;
                  Content-Type / filename / extension are NOT trusted)

The actual image bytes are validated against the specs in
`reference.json -> artwork_specs`:

| Type       | Aspect | Pixels     | Max size |
| ---------- | ------ | ---------- | -------- |
| poster     | 2:3    | 600 x 900  | 200 KB   |
| banner     | 16:9   | 1280 x 720 | 200 KB   |
| thumbnail  | 16:9   | 640 x 360  | 200 KB   |

Errors are returned with editor-friendly messages, e.g.:

    HTTP/1.1 422 Unprocessable Entity
    {
      "detail": "Banner images must be 1280x720 pixels (16:9). The uploaded image is 2048x1152.",
      "code":   "invalid_dimensions",
      "field":  "file"
    }

Re-uploading the same `(episode_id, artwork_type)` replaces the
existing record + blob (no duplicate rows). The blob is written to a
swappable storage backend (local filesystem by default). To replace
the backend with Cloudflare R2 / S3 in a later phase, implement the
`Storage` protocol in `app.services.storage` and select it via
`STORAGE_BACKEND`.

### Validation Report (Phase 4)

`GET /admin/validation-report` inspects the current database and
returns every issue that would block publication:

    {
      "can_publish": false,
      "issues": [
        {
          "type":     "missing_section",
          "severity": "blocking",
          "entity":   "show",
          "entity_id": 7,
          "title":    "Pub No Sec",
          "message":  "Published show 'Pub No Sec' (id=7) has no section. ...",
          "fields":   { "slug": "pub-no-sec" }
        }
      ],
      "summary": {
        "blocking_issues":  1,
        "by_type":          { "missing_section": 1 },
        "shows_scanned":    3,
        "episodes_scanned": 12
      }
    }

Issue codes reported today:

    SHOW:    missing_section, missing_categories
    EPISODE: missing_duration, missing_artwork

Authentication is intentionally not required yet (Phase 5).


### Authentication & Roles (Phase 5)

All API endpoints (CRUD, artwork, validation report) require a Bearer
access token issued by `POST /auth/login`. The login response carries
`access_token` + `token_type: "bearer"`.

Two roles are defined:

  * **editor** — can read / create / update / delete shows, seasons,
    episodes and artwork, and view the publish-blocker report.
  * **admin** — everything an editor can do, plus publishing the
    catalogue (placeholder endpoint in Phase 5; real implementation
    in Phase 6).

Endpoints are gated with three reusable FastAPI dependencies:

    get_current_user() -> User            resolves the bearer token
    require_editor()   -> User (editor or admin)
    require_admin()    -> User (admin only)

HTTP status codes for auth failures:

  * `401 not_authenticated` — no / malformed / expired / revoked token
  * `403 insufficient_role` — authenticated but wrong role

To enable the development-only seed users, set:

    DEV_SEED_USERS=true
    DEV_EDITOR_EMAIL=...
    DEV_EDITOR_PASSWORD=...
    DEV_ADMIN_EMAIL=...
    DEV_ADMIN_PASSWORD=...

JWT signing settings are also environment-driven:

    JWT_SECRET_KEY=...                # REQUIRED in production
    JWT_ALGORITHM=HS256               # default
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60


### HTTP Status Codes

- `200` / `201` for reads / creates
- `204` for deletes
- `400` / `422` for invalid input
- `404` for missing resources
- `409` for uniqueness / conflict errors
- `500` for storage backend failures (Phase 4)



### Catalogue Publishing + Public Catalogue (Phase 6)

#### Endpoints

* `POST /admin/catalog/publish` (admin only) runs the atomic publish pipeline:
  - Validates the DB with `app.services.validation_report`. If any blocking
    issue exists, the run is recorded as `failed`, the validation report
    is returned in `details.validation`, and the live catalogue is **not**
    touched. Response: `422 validation_failed`.
  - Otherwise builds a deterministic JSON catalogue from the published shows +
    published episodes, writes it to `catalogue/versions/<publish-run-id>.json`,
    and atomically updates the live pointer `catalogue/live.json`.
    Response: `200 completed`.
  - Storage or pipeline failure: `500 publish_failed`.

* `GET /admin/catalog/publish-runs` (editor or admin): newest-first list of
  past `PublishRun` rows for the future CMS history view. Paginated
  (`page`, `page_size`).

* `GET /catalog` (public): returns the currently published catalogue verbatim.
  If nothing has been published yet, returns the empty envelope
  (`{"version": 1, "published_at": null, "publish_run_id": null,
  "sections": []}`).

* `GET /catalog/search` (public): filters the currently published catalogue
  server-side. All filters compose with AND semantics:
  - `q`: case-insensitive substring on show title, episode title, or any
    show category.
  - `category`: exact match on a show category.
  - `language`: the show has a published episode in this language.
  - `section`: exact match on the show's section key.

  Response: `{ "query": {...}, "count": N, "results": [show, ...] }`.

#### Catalogue JSON structure

```json
{
  "version": 1,
  "published_at": "2026-09-05T12:34:56.789+00:00",
  "publish_run_id": 7,
  "sections": [
    {
      "key": "featured",
      "shows": [
        {
          "id": 1, "slug": "motis-many-lives",
          "title": "Motis: Many Lives",
          "synopsis": "...",
          "section": "featured",
          "categories": ["adventure", "india"],
          "trailers": [
            {
              "content_group": "motis-many-lives-s00e01",
              "languages": ["en"],
              "canonical_language": "en",
              "title": "Trailer",
              "episode_number": 1,
              "duration": 60,
              "artwork": { "poster": { "url": "/storage/...", "type": "poster", ... } }
            }
          ],
          "seasons": [
            {
              "season_number": 1,
              "episodes": [
                {
                  "content_group": "motis-many-lives-s01e02",
                  "languages": ["en", "hi"],
                  "canonical_language": "en",
                  "title": "Rain on the Roof",
                  "episode_number": 2,
                  "duration": 600,
                  "artwork": {
                    "poster":    { "type": "poster",    "url": "/storage/...", "width": 600,  "height": 900, "mime_type": "image/jpeg" },
                    "banner":    { "type": "banner",    "url": "/storage/...", "width": 1280, "height": 720, "mime_type": "image/jpeg" },
                    "thumbnail": { "type": "thumbnail", "url": "/storage/...", "width": 640,  "height": 360, "mime_type": "image/jpeg" }
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    { "key": "series",     "shows": [ ... ] },
    { "key": "minisodes",  "shows": [ ... ] },
    { "key": "songs",      "shows": [ ... ] }
  ]
}
```

Section order is **always** `featured, series, minisodes, songs` so the viewer
can iterate deterministically. Sections with no published shows still appear
(`key + shows: []`) for the same reason.

#### `content_group` language collapsing

Two episodes with the same `content_group` but different `language` values
are language variants of the SAME logical episode. The published catalogue
collapses them into **one** entry whose `languages` list enumerates every
variant. The variant whose `language == "en"` is used for the canonical
shared metadata (title, episode_number, duration, artwork references). When
no English variant exists the lexicographically smallest language code wins.
The `languages` list itself is sorted lexicographically, so the JSON byte
sequence is deterministic.

#### Season 0 / trailers

Season `0` is reserved for trailers and is **never** represented as a normal
season. Trailer episodes live in the show-level `trailers` array; the
`seasons` array only contains seasons `>= 1`. The viewer can iterate
`show.seasons[]` without worrying about Season 0 ever appearing in the
regular season list.

#### Atomic publication

Local storage uses an atomic filesystem temp-file + `os.replace` strategy
for live catalogue publication. Rename on a single filesystem is atomic,
so a concurrent reader always sees either the previous complete catalogue
or the new complete one — never a partial file. The publisher applies
the same pattern explicitly for the live pointer:

1. Build the complete catalogue in memory.
2. Serialise deterministically (`json.dumps(..., sort_keys=True)`).
3. Write the **immutable** version blob at
   `catalogue/versions/<publish-run-id>.json` via `storage.save`.
4. Atomically replace `catalogue/live.json` with the same bytes using a
   sibling temp file + `os.replace`, so readers always see either the
   previous complete catalogue or the new complete one (never a partial
   file).
5. Mark the `PublishRun` row `COMPLETED` with the counts.

Failure handling:

| Failure point                | Live pointer     | PublishRun row |
| ---------------------------- | ---------------- | --------------- |
| validation_report blocks     | unchanged        | FAILED          |
| build / serialise error      | unchanged        | FAILED          |
| version save fails           | unchanged        | FAILED          |
| live pointer update fails    | unchanged        | FAILED          |
| mark COMPLETED fails (rare)  | NEW (visible)    | left RUNNING    |

If the live pointer update fails after the version blob has been written,
the orphan version lives under `catalogue/versions/` and can be reaped
later. The previous live catalogue remains the public answer until a new
publish succeeds.

#### Storage abstraction vs. Cloudflare R2

A production Cloudflare R2 implementation would use an equivalent
atomic publication/manifest strategy appropriate to object storage
rather than filesystem rename — for example, uploading the new catalogue
bytes under an immutable key plus an atomic pointer flip (a versioned
object, a head `PutObject` with `If-None-Match: *`, a signed manifest,
or a CDN edge worker that swaps a manifest pointer in a single atomic
write). The filesystem `temp + os.replace` trick does not translate to
object storage directly; the *intent* (readers never see a partial
catalogue) does. The `Storage` abstraction in `app.services.storage`
keeps storage-specific operations isolated from catalogue-building and
API code so an R2 implementation can be added in a later phase without
changing any caller.

#### Why the public catalogue is separate from DB reads

`GET /catalog` reads only the on-storage JSON. Admin mutations to the live
database (editing a title, uploading an artwork, removing an episode) do
NOT affect what viewers see until the admin runs
`POST /admin/catalog/publish` again. This guarantees:

* Viewers never observe a partially-mutated catalogue.
* The viewer React app reads a CDN-cacheable URL
  (`/storage/catalogue/live.json`) instead of hammering the DB.
* Search and browse never run SQL against the live tables.

#### Search implementation + scale limitation

`GET /catalog/search` runs server-side. The browser never downloads the
whole catalogue just to search.

For this take-home the catalogue is loaded into the API process and
filtered in memory. **Acceptable up to a few thousand shows / tens of
thousands of episodes.** Beyond that, the next step is to index the
published catalogue into an external search engine (Postgres full-text,
Meilisearch, Typesense, Algolia, OpenSearch, ...) and serve queries from
the index. The endpoint contracts in this document would not change.

#### Catalogue assumptions

* Sections come from `reference.json -> sections` and are never invented
  at runtime.
* Show categories come from `reference.json -> categories`.
* `content_group` + `language` is unique per episode (enforced by the
  existing `uq_episode_content_language` constraint).
* Artwork types are exactly `poster`, `banner`, `thumbnail`.
* Artwork `url`s come from `Storage.get_url` -- the storage abstraction
  hides the filesystem so a future R2 backend can drop in without
  changing any caller.




## Tests

```bash
cd backend
pytest
```

Tests use an in-memory SQLite database with a single shared
connection (`StaticPool`) so multiple sessions in the same test see
the same tables. The fixture overrides `get_db` so request handlers
run against the test engine.

## Project Structure

```
backend/
+-- app/
¦   +-- __init__.py
¦   +-- main.py                  # FastAPI entry point
¦   +-- api/                     # HTTP routes
¦   ¦   +-- __init__.py
¦   ¦   +-- deps.py              # FastAPI dependencies
¦   ¦   +-- errors.py            # service-error -> HTTP handlers
¦   ¦   +-- shows.py             # /api/shows CRUD
¦   ¦   +-- seasons.py           # /api/seasons CRUD
¦   ¦   +-- episodes.py          # /api/episodes CRUD
¦   +-- core/                    # cross-cutting config
¦   ¦   +-- config.py
¦   ¦   +-- enums.py             # reference.json-derived constants
¦   ¦   +-- pagination.py        # pagination helpers
¦   +-- db/                      # SQLAlchemy engine + Base
¦   ¦   +-- base.py
¦   ¦   +-- session.py
¦   +-- models/                  # ORM models (Phase 2)
¦   +-- schemas/                 # Pydantic request/response schemas
¦   ¦   +-- __init__.py
¦   ¦   +-- common.py
¦   ¦   +-- user.py
¦   ¦   +-- show.py
¦   ¦   +-- season.py
¦   ¦   +-- episode.py
¦   ¦   +-- artwork.py
¦   ¦   +-- publish.py
¦   +-- services/                # DB-access logic
¦       +-- __init__.py
¦       +-- errors.py            # NotFoundError, ConflictError, ValidationFailure
¦       +-- shows.py
¦       +-- seasons.py
¦       +-- episodes.py
¦       +-- seed.py              # seed_shows.json loader
+-- alembic/                     # Migrations (Phase 2)
+-- tests/                       # Pytest suite
¦   +-- __init__.py
¦   +-- conftest.py
¦   +-- test_crud_basic.py
¦   +-- test_pagination.py
¦   +-- test_validation.py
¦   +-- test_seed.py
+-- alembic.ini
+-- pytest.ini
+-- requirements.txt
+-- README.md
```

## Alembic Commands

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1

# Show migration history
alembic history

# Show current migration
alembic current
```


