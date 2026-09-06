import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section style={{ padding: 24 }}>
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist.</p>
      <Link to="/app/shows">Back to Shows</Link>
    </section>
  );
}