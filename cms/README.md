# Peblo TV CMS

A small React + TypeScript admin shell for the Peblo TV catalogue.
**Phase 7A ships the foundation only** (auth, layout, routing, typed API
client, TanStack Query setup). CRUD, artwork upload, and the publish UI
land in later phases.

The Viewer app (a separate React app for end-users) is intentionally
NOT implemented here.

## Requirements

- Node.js 20+
- npm 10+
- The backend running locally on `http://localhost:8000` (see `../backend/README.md`).

## Quick Start

```bash
cd cms
npm install
cp .env.example .env
npm run dev      # http://localhost:5173
```

Set `VITE_API_BASE_URL` in `.env` if your backend lives elsewhere.

## Scripts

| Command              | Purpose                          |
| -------------------- | -------------------------------- |
| `npm run dev`        | Vite dev server                  |
| `npm run build`      | Type-check + production build    |
| `npm run preview`    | Preview the production build     |
| `npm run typecheck`  | TypeScript-only check (no emit)  |
| `npm run lint`       | ESLint                           |
| `npm test`           | Vitest (one-shot)                |
| `npm run test:watch` | Vitest in watch mode             |

## Project Structure

```
cms/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── src/
    ├── main.tsx                    # React entry point
    ├── App.tsx                     # Provider tree
    ├── index.css                   # Global styles
    ├── config.ts                   # Reads VITE_API_BASE_URL
    ├── queryClient.ts              # Shared TanStack QueryClient
    ├── api/
    │   ├── client.ts               # Fetch wrapper + typed errors
    │   ├── auth.ts                 # /auth/login, /auth/me
    │   ├── shows.ts                # /api/shows
    │   ├── seasons.ts              # /api/seasons
    │   ├── episodes.ts             # /api/episodes
    │   ├── artwork.ts              # /api/episodes/{id}/artwork
    │   ├── validation.ts           # /admin/validation-report
    │   └── publish.ts              # /admin/catalog/publish*
    ├── auth/
    │   ├── tokenStorage.ts         # localStorage wrapper
    │   ├── AuthContext.tsx         # User state machine
    │   └── useAuth.ts              # Consumer hook
    ├── hooks/
    │   └── useCurrentUser.ts       # /auth/me via TanStack Query
    ├── components/
    │   ├── LoadingState.tsx
    │   ├── EmptyState.tsx
    │   ├── ErrorState.tsx
    │   └── PermissionDenied.tsx
    ├── layouts/
    │   ├── CmsLayout.tsx           # Sidebar + topbar + Outlet
    │   └── CmsLayout.css
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── LoginPage.css
    │   ├── ShowsPage.tsx           # placeholder (Phase 7B)
    │   ├── PublishPage.tsx         # placeholder (Phase 7C)
    │   └── NotFoundPage.tsx
    ├── routes/
    │   ├── AppRouter.tsx           # <Routes> tree
    │   ├── ProtectedRoute.tsx      # gate on `authenticated`
    │   └── AdminRoute.tsx          # gate on `role === admin`
    ├── types/
    │   └── api.ts                  # central API response types
    └── test/
        └── setup.ts                # Vitest setup (jest-dom)
```

## Architecture

### State management

- **Auth state** lives in `AuthContext` (status: `loading | authenticated |
  unauthenticated`). It is the source of truth for the current user and
  for the role check that gates admin UI.
- **Server state** lives in TanStack Query. The shared `QueryClient`
  (`src/queryClient.ts`) sets:
  - `staleTime: 30_000`
  - `refetchOnWindowFocus: false`
  - `retry: 1` (queries), `0` (mutations)
  - `gcTime: 5 * 60_000`

  Per-query overrides (e.g. disabling retry on `/auth/me`) are defined at
  the call site.

### API client

`src/api/client.ts` is the single place every CMS HTTP request flows
through. It:

- Reads the access token from `tokenStorage` and attaches
  `Authorization: Bearer <token>` to every non-`skipAuth` request.
- Builds URLs from `VITE_API_BASE_URL`.
- Translates backend error envelopes (`{ detail, code, field, ... }`) into
  typed error subclasses — `UnauthorizedError`, `PermissionDeniedError`,
  `NotFoundError`, `ValidationFailedError`, `ApiError`. The `.message`
  on each instance is a human-readable string ready for `<ErrorState />`.
- On a `401`, fires the registered `onUnauthorized` callback so the
  `AuthContext` clears the token and the user is bounced back to
  `/login`.

The endpoint-specific functions in `src/api/*.ts` are thin wrappers that
just call `apiFetch` with a typed path and typed return value.

### Routing

React Router v6.

| Path             | Guard                              | Page          |
| ---------------- | ---------------------------------- | ------------- |
| `/login`         | redirect to `/app/shows` if authed | `LoginPage`   |
| `/app`           | `ProtectedRoute`                   | → `/app/shows`|
| `/app/shows`     | `ProtectedRoute`                   | `ShowsPage`   |
| `/app/publish`   | `ProtectedRoute` → `AdminRoute`    | `PublishPage` |
| `*`              | none                               | `NotFoundPage`|

`ProtectedRoute` waits for the auth state to leave `loading` before
deciding; this avoids a flash of `/login` when restoring a session.

`AdminRoute` renders a `<PermissionDenied />` state for authenticated
non-admin users — we do NOT redirect, so editors who land on the URL
from a bookmark see a clear explanation.

### Role handling

- The user's role comes from `/auth/me`, **never** from a frontend input.
- The sidebar hides `Publish` for non-admins.
- Backend authorisation remains authoritative.

## Configuration

`cms/.env.example` lists the supported variables:

```
VITE_API_BASE_URL=http://localhost:8000
```

Copy it to `.env` (or `.env.local`) and adjust as needed. Anything not
prefixed with `VITE_` is not exposed to the client by Vite.

## Tests

Vitest + Testing Library. See `src/test/setup.ts` for the test bootstrap.

Notable test files:

- `src/api/client.test.ts` — fetch wrapper translates 401/403/404/422 into
  the right typed errors; raw stack traces never leak into messages.
- `src/auth/AuthContext.test.tsx` — login success, login failure,
  401-clears-state, role-aware admin route, protected-route redirects.

## Phase 7A Limitations

- `ShowsPage` and `PublishPage` are placeholders — CRUD UI ships later.
- No artwork upload UI yet (Phase 7C).
- No Dockerfile / GitHub Actions yet.
- Token storage uses `localStorage` (acceptable for a take-home; a
  production CMS would use HttpOnly cookies or in-memory + refresh).