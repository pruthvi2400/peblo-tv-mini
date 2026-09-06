/**
 * Login page.
 *
 * Submits to `useAuth().login`, which stores the access token and then
 * loads /auth/me to populate the AuthContext.
 */
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import './LoginPage.css';

export function LoginPage() {
  const { status, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Navigate to="/app/shows" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login({ email, password });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to log in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <h1 className="login-card__title">Peblo TV CMS</h1>
        <p className="login-card__subtitle">Sign in to manage the catalogue.</p>

        {errorMessage && (
          <ErrorState
            title="Login failed"
            message={errorMessage}
          />
        )}

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            disabled={submitting || status === 'loading'}
            data-testid="login-email"
          />
        </label>

        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting || status === 'loading'}
            data-testid="login-password"
          />
        </label>

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={submitting || status === 'loading' || !email || !password}
          data-testid="login-submit"
        >
          {submitting ? <LoadingState label="Signing in…" /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}