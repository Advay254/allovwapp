import { Link, useLocation } from 'react-router-dom';
import { Logo } from '../components/logo';
import { runtimeConfig } from '../lib/config';
import { useDocumentTitle } from '../lib/use-title';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { prefix } = runtimeConfig();
  const location = useLocation();
  const inDashboard = location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="font-mono text-sm text-muted">Error 404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 text-base text-muted">
          The page you asked for does not exist or has moved. Check the address and try again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {inDashboard ? (
            <Link
              to={prefix}
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-ink no-underline hover:bg-brand-deep"
            >
              Go to Overview
            </Link>
          ) : null}
          <Link
            to="/"
            className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink no-underline hover:bg-canvas"
          >
            Go to the home page
          </Link>
        </div>
      </main>
    </div>
  );
}
