import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { runtimeConfig } from './lib/config';
import { RequireSession } from './lib/session';
import { NotFoundPage } from './pages/not-found';
import { OverviewPage } from './pages/overview';
import { PublicHomePage } from './pages/public-home';
import { SettingsPage } from './pages/settings';
import { SignInPage } from './pages/sign-in';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function AppRoutes({ prefix }: { prefix: string }) {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path={`${prefix}/login`} element={<SignInPage />} />
      <Route
        path={prefix}
        element={
          <RequireSession>
            <AppShell />
          </RequireSession>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  const { prefix } = runtimeConfig();
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes prefix={prefix} />
      </BrowserRouter>
    </AppProviders>
  );
}
