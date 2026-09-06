/**
 * Validation report API (Phase 4 backend surface).
 */
import { apiFetch } from './client';
import type { ValidationReport } from '../types/api';

export function getValidationReport(): Promise<ValidationReport> {
  return apiFetch<ValidationReport>('/admin/validation-report');
}