import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PARENT_BRAND, type SessionResponse } from '@allov/shared';
import { Banner } from '../components/banner';
import { Button } from '../components/button';
import { DbBanner } from '../components/db-banner';
import { TextField } from '../components/field';
import { Logo } from '../components/logo';
import { ApiError, api, setCsrfSecret } from '../lib/api';
import { runtimeConfig } from '../lib/config';
import { formatCountdown } from '../lib/format';
import { useSession } from '../lib/session';
import { useDocumentTitle } from '../lib/use-title';

export function SignInPage() {
  useDocumentTitle('Sign in');
  const { prefix } = runtimeConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  const login = useMutation({
    mutationFn: () => api.post<SessionResponse>('/auth/login', { username, password }),
    onSuccess: (data) => {
      setCsrfSecret(data.csrfSecret);
      queryClient.setQueryData(['session'], data);
      navigate(prefix, { replace: true });
    },
    onError: (err) => {
      setPassword('');
      if (err instanceof ApiError && err.code === 'too_many_attempts' && err.retryAfterSeconds) {
        setWaitUntil(Date.now() + err.retryAfterSeconds * 1000);
      }
    },
  });

  // Live countdown while sign in is paused.
  useEffect(() => {
    if (waitUntil === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setWaitUntil(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  if (session.data) return <Navigate to={prefix} replace />;

  const paused = waitUntil !== null && remaining > 0;
  const error = login.error instanceof ApiError ? login.error : null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!paused && !login.isPending) login.mutate();
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <DbBanner />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
          <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the owner account for this AllovWapp instance.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              label="Username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <div aria-live="polite">
              {paused ? (
                <Banner tone="warning" title="Sign in is paused after too many failed attempts">
                  You can try again in{' '}
                  <span className="font-mono text-ink">{formatCountdown(remaining)}</span>.
                </Banner>
              ) : error ? (
                <Banner tone="danger" title={error.message}>
                  {error.code === 'invalid_credentials'
                    ? 'Check both fields and try again.'
                    : error.requestId
                      ? `Request id ${error.requestId}`
                      : undefined}
                </Banner>
              ) : null}
            </div>

            <Button
              type="submit"
              icon={LogIn}
              loading={login.isPending}
              disabled={paused || username.trim() === '' || password === ''}
              className="w-full"
            >
              Sign in
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">{PARENT_BRAND}</p>
      </main>
    </div>
  );
}
