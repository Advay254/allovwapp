import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../app';

const SESSION = {
  user: { id: '11111111-1111-4111-8111-111111111111', username: 'owner' },
  workspaces: [
    { id: '22222222-2222-4222-8222-222222222222', name: 'My workspace', role: 'owner' },
  ],
  csrfSecret: 'csrf-secret-for-tests',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(signedIn: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/health') return json({ status: 'ok', version: '1.0.0', database: 'ready' });
      if (url.endsWith('/auth/session')) {
        return signedIn
          ? json(SESSION)
          : json({ error: { code: 'unauthenticated', message: 'Sign in.', requestId: 'req_1' } }, 401);
      }
      if (url.endsWith('/system/status')) {
        return json({
          version: '1.0.0',
          uptimeSeconds: 120,
          database: { status: 'ready', lastCheckAt: new Date().toISOString(), reason: null },
          warnings: [],
        });
      }
      if (url.includes('/audit')) return json({ items: [], page: 1, pageSize: 10, total: 0 });
      if (url.endsWith('/auth/sessions')) return json({ items: [] });
      if (url.includes('/workspaces/')) {
        return json({
          id: SESSION.workspaces[0]?.id,
          name: 'My workspace',
          role: 'owner',
          memberCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      }
      return json({ error: { code: 'not_found', message: 'Not found.', requestId: 'req_2' } }, 404);
    }),
  );
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes prefix="/app" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // The dashboard must work with browser storage completely unavailable.
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new Error('browser storage is not available');
      },
    });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('dashboard shell', () => {
  it('renders the overview and navigates to settings with no browser storage', async () => {
    mockFetch(true);
    renderAt('/app');
    expect(await screen.findByText('System status')).toBeTruthy();

    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0] as HTMLElement;
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Overview', 'Settings']);

    fireEvent.click(within(nav).getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Security' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeTruthy();
  });

  it('sends signed out visitors to the sign in page', async () => {
    mockFetch(false);
    renderAt('/app');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('shows the public page without any link to sign in', async () => {
    mockFetch(false);
    renderAt('/');
    expect(await screen.findByText('One gateway. Every integration.')).toBeTruthy();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  it('shows the 404 page for unknown paths', async () => {
    mockFetch(false);
    renderAt('/nothing-here');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
