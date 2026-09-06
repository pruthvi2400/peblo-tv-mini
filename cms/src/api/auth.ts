/**
 * Auth API surface.
 *
 *  - POST /auth/login  -> { access_token, token_type }
 *  - GET  /auth/me     -> CurrentUser
 */
import { apiFetch } from './client';
import type { CurrentUser, LoginRequest, LoginResponse } from '../types/api';

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me');
}