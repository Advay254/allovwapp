import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LogOut } from 'lucide-react';
import { useState } from 'react';
import type { SessionList } from '@allov/shared';
import { Banner } from '../components/banner';
import { Button } from '../components/button';
import { Card } from '../components/card';
import { ErrorBlock } from '../components/error-block';
import { CardSkeleton } from '../components/skeleton';
import { ApiError, api } from '../lib/api';
import { absoluteTime, describeDevice, relativeTime } from '../lib/format';

export function SettingsSecurity() {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<SessionList>('/auth/sessions'),
  });
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['sessions'] });

  const revokeOne = useMutation({
    mutationFn: (id: string) => api.del(`/auth/sessions/${id}`),
    onSuccess: () => {
      setMessage('That session was signed out.');
      refresh();
    },
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.del<{ ok: boolean; count: number }>('/auth/sessions'),
    onSuccess: (data) => {
      setMessage(
        data.count === 1 ? '1 other session was signed out.' : `${data.count} other sessions were signed out.`,
      );
      refresh();
    },
  });

  const others = sessions.data?.items.filter((item) => !item.current) ?? [];
  const failure = revokeOne.error ?? revokeOthers.error;

  return (
    <Card
      title="Security"
      description="Places where your account is signed in. Sessions end on their own after 6 hours."
    >
      {sessions.isPending ? (
        <CardSkeleton rows={3} />
      ) : sessions.isError ? (
        <ErrorBlock error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-line rounded-md border border-line">
            {sessions.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-4">
                <Laptop className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {describeDevice(item.userAgent)}
                    {item.current ? (
                      <span className="ml-2 rounded-sm border border-line-strong px-1.5 py-0.5 text-xs font-medium">
                        This device
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted">
                    <span className="font-mono text-xs">{item.ip ?? 'Unknown address'}</span>
                    {' · '}
                    Last seen{' '}
                    <time dateTime={item.lastSeenAt} title={absoluteTime(item.lastSeenAt)}>
                      {relativeTime(item.lastSeenAt)}
                    </time>
                  </p>
                </div>
                {item.current ? null : (
                  <Button
                    variant="secondary"
                    icon={LogOut}
                    loading={revokeOne.isPending && revokeOne.variables === item.id}
                    onClick={() => {
                      setMessage(null);
                      revokeOne.mutate(item.id);
                    }}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div aria-live="polite" className="space-y-3">
            {message ? <Banner tone="success" title={message} /> : null}
            {failure instanceof ApiError ? <Banner tone="danger" title={failure.message} /> : null}
          </div>

          <Button
            variant="danger"
            icon={LogOut}
            loading={revokeOthers.isPending}
            disabled={others.length === 0}
            onClick={() => {
              setMessage(null);
              revokeOthers.mutate();
            }}
          >
            Sign out everywhere else
          </Button>
          {others.length === 0 ? (
            <p className="text-sm text-muted">There are no other active sessions.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
