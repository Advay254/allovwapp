import { LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { runtimeConfig } from '../lib/config';
import { useSession } from '../lib/session';
import { useDocumentTitle } from '../lib/use-title';
import { AccountMenu } from './account-menu';
import { DbBanner } from './db-banner';
import { Logo } from './logo';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function AppShell() {
  const session = useSession();
  const location = useLocation();
  const { prefix } = runtimeConfig();

  const items: NavItem[] = [
    { to: prefix, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `${prefix}/settings`, label: 'Settings', icon: Settings },
  ];
  const title = location.pathname.replace(/\/+$/, '').endsWith('/settings') ? 'Settings' : 'Overview';
  useDocumentTitle(title);

  const username = session.data?.user.username ?? '';
  const workspace = session.data?.workspaces[0];

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* 1024 pixels and wider: sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex h-14 items-center px-5">
          <Logo />
        </div>
        <nav aria-label="Primary" className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-sm no-underline ${
                      isActive
                        ? 'border-brand bg-canvas font-semibold text-ink'
                        : 'border-transparent text-muted hover:bg-canvas hover:text-ink'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {workspace ? (
          <div className="border-t border-line px-5 py-4">
            <p className="text-xs text-muted">Workspace</p>
            <p className="truncate text-sm font-medium text-ink">{workspace.name}</p>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-14 items-center gap-4 border-b border-line bg-surface px-4 md:px-6">
          <Logo className="lg:hidden" />
          {/* 768 to 1023 pixels: links sit in the top bar */}
          <nav aria-label="Primary" className="hidden md:block lg:hidden">
            <ul className="flex gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex min-h-11 items-center rounded-md px-3 text-sm no-underline ${
                        isActive
                          ? 'bg-canvas font-semibold text-ink underline decoration-brand decoration-2 underline-offset-8'
                          : 'text-muted hover:text-ink'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <h1 className="hidden font-display text-xl font-semibold lg:block">{title}</h1>
          <div className="ml-auto">
            <AccountMenu username={username} />
          </div>
        </header>

        <DbBanner />

        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-28 md:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Below 768 pixels: bottom navigation with large touch targets */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface md:hidden"
      >
        <ul className="grid grid-cols-2">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-4 text-xs no-underline ${
                    isActive
                      ? 'border-brand font-semibold text-ink'
                      : 'border-transparent text-muted'
                  }`
                }
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
