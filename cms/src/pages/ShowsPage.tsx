/**
 * ShowsPage — Phase 7B entry point.
 *
 * Kept as a tiny wrapper that delegates to `ShowsListPage` so existing
 * route definitions stay stable; the list page is the heavy lifter.
 */
import { ShowsListPage } from './shows/ShowsListPage';

export function ShowsPage() {
  return <ShowsListPage />;
}