import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { SessionResponse } from '@allov/shared';
import { ErrorBlock } from '../components/error-block';
import { ShellSkeleton } from '../components/skeleton';
import { ApiError, api, setCsrfSecret } from './api';
import { runtimeConfig } from './config';

/** The session query resolves to null when nobody is signed in. */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionResponse | null> => {
      try {
        const session = await api.get<SessionResponse>('/auth/session');
        setCsrfSecret(session.csrfSecret);
        return session;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setCsrfSecret(null);
          return null;
        }
        throw err;
      }
    },
  });
}

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.isPending) return <ShellSkeleton />;
  if (session.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorBlock error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) return <Navigate to={`${runtimeConfig().prefix}/login`} replace />;
  return <>{children}</>;
}
