/**
 * CMS shell layout.
 *
 *   ┌──────────┬────────────────────────────────────┐
 *   │ Sidebar  │ Topbar (user, role, logout)        │
 *   │ (nav)    ├────────────────────────────────────┤
 *   │          │ <Outlet /> (page content)          │
 *   └──────────┴────────────────────────────────────┘
 *
 * Navigation rules:
 *   - "Shows"      : visible to every authenticated user.
 *   - "Publish"    : visible to admins only. (Frontend hiding is not
 *                    security; the backend remains authoritative.)
 *
 * The sidebar collapses below a sensible breakpoint so the layout works
 * on a narrow window. We don't aim for full mobile polish in Phase 7A.
 */
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import './CmsLayout.css';

export function CmsLayout() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="cms-shell">
      <aside className="cms-shell__sidebar" aria-label="Primary">
        <div className="cms-shell__brand">
          <span className="cms-shell__brand-mark">P</span>
          <span className="cms-shell__brand-text">Peblo TV CMS</span>
        </div>
        <nav>
          <ul className="cms-shell__nav">
            <li>
              <NavLink
                to="/app/shows"
                className={({ isActive }) =>
                  isActive ? 'cms-shell__nav-link is-active' : 'cms-shell__nav-link'
                }
              >
                Shows
              </NavLink>
            </li>
            {isAdmin && (
              <li>
                <NavLink
                  to="/app/publish"
                  className={({ isActive }) =>
                    isActive ? 'cms-shell__nav-link is-active' : 'cms-shell__nav-link'
                  }
                >
                  Publish
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </aside>

      <div className="cms-shell__main">
        <header className="cms-shell__topbar">
          <div className="cms-shell__topbar-meta">
            {user ? (
              <>
                <span className="cms-shell__user" data-testid="cms-current-user">
                  {user.email}
                </span>
                <span
                  className={`cms-shell__role cms-shell__role--${user.role}`}
                  data-testid="cms-current-role"
                >
                  {user.role}
                </span>
              </>
            ) : (
              <span className="cms-shell__user">Not signed in</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={logout}
            data-testid="cms-logout"
          >
            Log out
          </button>
        </header>
        <main className="cms-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}