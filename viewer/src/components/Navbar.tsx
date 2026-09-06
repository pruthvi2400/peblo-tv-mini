// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { Link, useLocation } from 'react-router-dom';

export function Navbar() {
  const location = useLocation();
  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <Link to="/" className="navbar-logo">
            <span className="navbar-logo-icon">P</span>
            Peblo TV
          </Link>
        </div>
        <div className="navbar-links">
          <Link to="/" className={"navbar-link" + (location.pathname === "/" ? " active" : "")} data-testid="nav-home">Home</Link>
          <Link to="/search" className={"navbar-link" + (location.pathname === "/search" ? " active" : "")} data-testid="nav-search">Search</Link>
        </div>
      </div>
    </nav>
  );
}
