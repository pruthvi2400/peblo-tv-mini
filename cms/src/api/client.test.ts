/**
 * Tests for the API client wrapper.
 *
 *   - 401 → UnauthorizedError + onUnauthorized callback fires.
 *   - 403 → PermissionDeniedError.
 *   - 404 → NotFoundError.
 *   - 422 → ValidationFailedError (with field).
 *   - 500+ → ApiError with a friendly message.
 *   - happy-path JSON → parsed body.
 *   - happy-path 204 → undefined.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  NotFoundError,
  PermissionDeniedError,
  UnauthorizedError,
  ValidationFailedError,
  __resetApiConfig,
  apiFetch,
  configureApi,
} from './client';

const BASE = 'http://localhost:8000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  __resetApiConfig();
  vi.restoreAllMocks();
});

afterEach(() => {
  __resetApiConfig();
});

describe('apiFetch', () => {
  it('parses a successful JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' })),
    );
    const out = await apiFetch<{ hello: string }>('/foo');
    expect(out).toEqual({ hello: 'world' });
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const out = await apiFetch('/foo', { method: 'DELETE' });
    expect(out).toBeUndefined();
  });

  it('attaches the bearer token when one is configured', async () => {
    configureApi({ getToken: () => 'abc.def.ghi' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/foo');
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer abc.def.ghi');
  });

  it('skips auth when skipAuth is true', async () => {
    configureApi({ getToken: () => 'should-not-be-sent' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/auth/login', { method: 'POST', skipAuth: true, body: {} });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('stringifies JSON bodies and sets Content-Type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/foo', { method: 'POST', body: { a: 1 } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('translates 401 into UnauthorizedError and fires onUnauthorized', async () => {
    const onUnauth = vi.fn();
    configureApi({ onUnauthorized: onUnauth });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { detail: 'token expired', code: 'invalid_token' },
          401,
        ),
      ),
    );

    await expect(apiFetch('/foo')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(onUnauth).toHaveBeenCalledTimes(1);
  });

  it('uses the backend detail as the human message on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { detail: 'The access token is invalid or has expired.', code: 'invalid_token' },
          401,
        ),
      ),
    );
    try {
      await apiFetch('/foo');
      throw new Error('expected apiFetch to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect((err as Error).message).toContain('invalid');
    }
  });

  it('translates 403 into PermissionDeniedError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { detail: 'Admin privileges required.', code: 'insufficient_role' },
          403,
        ),
      ),
    );
    await expect(apiFetch('/foo')).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('translates 404 into NotFoundError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ detail: 'gone', code: 'not_found' }, 404),
      ),
    );
    await expect(apiFetch('/foo')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('translates 422 into ValidationFailedError with the field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            detail: 'slug is invalid',
            code: 'request_validation',
            field: 'slug',
          },
          422,
        ),
      ),
    );
    try {
      await apiFetch('/foo');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationFailedError);
      const v = err as ValidationFailedError;
      expect(v.field).toBe('slug');
      expect(v.code).toBe('request_validation');
      expect(v.message).toContain('slug');
    }
  });

  it('falls back to a friendly message for 5xx without leaking raw text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Traceback (most recent call last): ...', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );
    try {
      await apiFetch('/foo');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as Error).message).not.toContain('Traceback');
      expect((err as Error).message).toMatch(/server/i);
    }
  });
});

// Quiet the unused-import warning when running the suite in --watch mode.
void BASE;