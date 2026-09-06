/**
 * Helpers for mapping backend error envelopes to per-field, human-readable
 * form errors.
 */
import { ApiError } from './client';

export interface FieldErrors {
  [field: string]: string;
}

/**
 * Given any thrown value from a mutation, return a `{ fieldName: message }`
 * map for the backend's structured error envelope.
 *
 * The backend returns 422 with `{ detail, code, field, errors?: [...] }`.
 * We surface `field` (singular) AND walk the `errors[]` array if present
 * (the request validation handler emits per-loc errors there).
 */
export function pickFieldErrors(err: unknown): FieldErrors {
  if (!(err instanceof ApiError)) return {};
  const out: FieldErrors = {};
  const body = err.body;

  if (body && typeof body === 'object') {
    if (body.field && err.message) {
      out[body.field] = err.message;
    }
    const errs = (body as { errors?: unknown }).errors;
    if (Array.isArray(errs)) {
      for (const item of errs) {
        if (!item || typeof item !== 'object') continue;
        const e = item as Record<string, unknown>;
        const loc = e.loc;
        const msg = e.msg;
        if (Array.isArray(loc) && loc.length > 0 && typeof msg === 'string') {
          // Drop the leading "body" segment the FastAPI validator adds.
          const segments = loc.filter((s) => s !== 'body');
          const field = segments.join('.') || '_form';
          out[field] = msg;
        }
      }
    }
  }

  return out;
}

/** Human-readable error suitable for a top-of-form banner. */
export function pickTopMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}