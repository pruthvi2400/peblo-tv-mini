/**
 * Centralised typed API client.
 *
 * Goals:
 *   - One place where every CMS HTTP request is built.
 *   - Consistent error handling: every non-2xx response is converted
 *     into an `ApiError` with a human-readable message and a stable
 *     machine code; raw stack traces never reach the UI.
 *   - Bearer-token injection driven by a small token-store abstraction
 *     so tests can swap it out.
 *   - `onUnauthorized` callback so the AuthContext can react to a 401
 *     anywhere in the app (token cleared, user kicked to /login).
 */
import { API_BASE_URL } from '../config';
import type { ApiErrorBody } from '../types/api';

/** Allow callers (mainly tests) to override the token-store getter. */
type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let _getToken: TokenGetter = () => null;
let _onUnauthorized: UnauthorizedHandler = () => {
  /* noop by default */
};

export function configureApi(opts: {
  getToken?: TokenGetter;
  onUnauthorized?: UnauthorizedHandler;
}): void {
  if (opts.getToken) _getToken = opts.getToken;
  if (opts.onUnauthorized) _onUnauthorized = opts.onUnauthorized;
}

/** Used by tests to reset the overrides between cases. */
export function __resetApiConfig(): void {
  _getToken = () => null;
  _onUnauthorized = () => {
    /* noop */
  };
}

// ── Typed error classes ──────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly field: string | null;
  readonly body: ApiErrorBody | null;

  constructor(opts: {
    status: number;
    message: string;
    code?: string | null;
    field?: string | null;
    body?: ApiErrorBody | null;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code ?? null;
    this.field = opts.field ?? null;
    this.body = opts.body ?? null;
  }
}

export class PermissionDeniedError extends ApiError {
  constructor(opts: {
    message?: string;
    code?: string | null;
    body?: ApiErrorBody | null;
  }) {
    super({
      status: 403,
      message: opts.message ?? 'You do not have permission for this action.',
      code: opts.code ?? 'insufficient_role',
      body: opts.body ?? null,
    });
    this.name = 'PermissionDeniedError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(opts: {
    message?: string;
    code?: string | null;
    body?: ApiErrorBody | null;
  }) {
    super({
      status: 401,
      message: opts.message ?? 'Your session has expired. Please log in again.',
      code: opts.code ?? 'not_authenticated',
      body: opts.body ?? null,
    });
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends ApiError {
  constructor(opts: {
    message?: string;
    code?: string | null;
    body?: ApiErrorBody | null;
  }) {
    super({
      status: 404,
      message: opts.message ?? 'The requested resource was not found.',
      code: opts.code ?? 'not_found',
      body: opts.body ?? null,
    });
    this.name = 'NotFoundError';
  }
}

export class ValidationFailedError extends ApiError {
  constructor(opts: {
    message?: string;
    code?: string | null;
    field?: string | null;
    body?: ApiErrorBody | null;
  }) {
    super({
      status: 422,
      message: opts.message ?? 'The request was invalid.',
      code: opts.code ?? 'request_validation',
      field: opts.field ?? null,
      body: opts.body ?? null,
    });
    this.name = 'ValidationFailedError';
  }
}


// ── Response parsing ─────────────────────────────────────────────────────────

async function safeReadBody(res: Response): Promise<ApiErrorBody | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as ApiErrorBody;
    }
    return { detail: String(parsed) };
  } catch {
    return { detail: text.slice(0, 500) };
  }
}

function humaniseErrorBody(status: number, body: ApiErrorBody | null): string {
  // For 5xx we deliberately ignore the raw body so an unhandled exception
  // (stack trace, HTML error page, etc.) never leaks to the user.
  if (status >= 500) {
    return 'The server encountered an error. Please try again in a moment.';
  }
  const detail = body?.detail?.trim();
  if (detail) return detail;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403)
    return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'This action conflicts with existing data.';
  if (status === 422) return 'The request was invalid.';
  return `Request failed with status ${status}.`;
}

function buildErrorFor(res: Response, body: ApiErrorBody | null): ApiError {
  const message = humaniseErrorBody(res.status, body);
  const code = body?.code ?? null;
  const field = body?.field ?? null;

  if (res.status === 401) {
    return new UnauthorizedError({ message, code, body });
  }
  if (res.status === 403) {
    return new PermissionDeniedError({ message, code, body });
  }
  if (res.status === 404) {
    return new NotFoundError({ message, code, body });
  }
  if (res.status === 422) {
    return new ValidationFailedError({ message, code, field, body });
  }
  return new ApiError({
    status: res.status,
    message,
    code,
    field,
    body,
  });
}

// ── Request helper ───────────────────────────────────────────────────────────

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  query?: Record<string, string | number | boolean | null | undefined> | null;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined) continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}


/**
 * Low-level typed fetch wrapper. Every CMS request flows through here.
 *
 * On 401, the registered `onUnauthorized` handler fires so the
 * AuthContext can clear state and redirect to /login.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    formData,
    headers,
    skipAuth,
    signal,
  } = options;

  const url = buildUrl(path, query);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined && body !== null) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (!skipAuth) {
    const token = _getToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: payload,
    signal,
  });

  if (!res.ok) {
    const errBody = await safeReadBody(res);
    const err = buildErrorFor(res, errBody);
    if (err instanceof UnauthorizedError) {
      try {
        _onUnauthorized();
      } catch {
        /* swallow */
      }
    }
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
