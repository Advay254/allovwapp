import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import type { AuditPage, StatusDto, WorkspaceDto } from '@allov/shared';
import { Card, Stat } from '../components/card';
import { ErrorBlock } from '../components/error-block';
import { PageHeader } from '../components/page-header';
import { CardSkeleton } from '../components/skeleton';
import { Banner } from '../components/banner';
import { StatusPill } from '../components/status-pill';
import { api } from '../lib/api';
import { absoluteTime, actionLabel, formatUptime, relativeTime, roleLabel } from '../lib/format';
import { useSession } from '../lib/session';

function StatusCard() {
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<StatusDto>('/system/status'),
    refetchInterval: 30_000,
  });
  return (
    <Card title="System status" description="Live information from the running service.">
      {status.isPending ? (
        <CardSkeleton />
      ) : status.isError ? (
        <ErrorBlock error={status.error} onRetry={() => void status.refetch()} />
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label="Service version">
              <span className="font-mono text-sm">{status.data.version}</span>
            </Stat>
            <Stat label="Uptime">{formatUptime(status.data.uptimeSeconds)}</Stat>
            <Stat label="Database">
              {status.data.database.status === 'ready' ? (
                <StatusPill tone="ok">Ready</StatusPill>
              ) : status.data.database.status === 'connecting' ? (
                <StatusPill tone="warn">Connecting</StatusPill>
              ) : (
                <StatusPill tone="bad">Error</StatusPill>
              )}
              {status.data.database.lastCheckAt ? (
                <span className="mt-0.5 block text-sm font-normal text-muted">
                  Last check{' '}
                  <time
                    dateTime={status.data.database.lastCheckAt}
                    title={absoluteTime(status.data.database.lastCheckAt)}
                  >
                    {relativeTime(status.data.database.lastCheckAt)}
                  </time>
                </span>
              ) : null}
            </Stat>
          </dl>
          {status.data.warnings.length > 0 ? (
            <Banner tone="warning" title="Configuration warnings">
              <ul className="list-disc space-y-1 pl-5">
                {status.data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Banner>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function WorkspaceCard({ workspaceId }: { workspaceId: string }) {
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<WorkspaceDto>(`/workspaces/${workspaceId}`),
  });
  return (
    <Card title="Workspace">
      {workspace.isPending ? (
        <CardSkeleton rows={2} />
      ) : workspace.isError ? (
        <ErrorBlock error={workspace.error} onRetry={() => void workspace.refetch()} />
      ) : (
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat label="Name">{workspace.data.name}</Stat>
          <Stat label="Your role">{roleLabel(workspace.data.role)}</Stat>
          <Stat label="Members">{workspace.data.memberCount}</Stat>
        </dl>
      )}
    </Card>
  );
}

function ActivityCard({ workspaceId }: { workspaceId: string }) {
  const audit = useQuery({
    queryKey: ['audit', workspaceId, 1],
    queryFn: () => api.get<AuditPage>(`/workspaces/${workspaceId}/audit?page=1&pageSize=10`),
  });
  return (
    <Card title="Recent activity" description="Sign ins, sign outs and settings changes.">
      {audit.isPending ? (
        <CardSkeleton rows={4} />
      ) : audit.isError ? (
        <ErrorBlock error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.data.items.length === 0 ? (
        <p className="text-sm text-muted">No activity has been recorded yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {audit.data.items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{actionLabel(item.action)}</p>
                {item.actor ? (
                  <p className="truncate text-sm text-muted">
                    by <span className="font-mono text-xs">{item.actor}</span>
                  </p>
                ) : null}
              </div>
              <time
                dateTime={item.createdAt}
                title={absoluteTime(item.createdAt)}
                className="shrink-0 text-sm text-muted"
              >
                {relativeTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function OverviewPage() {
  const session = useSession();
  const workspaceId = session.data?.workspaces[0]?.id;
  return (
    <>
      <PageHeader
        title="Overview"
        helper="The state of this AllovWapp instance and your workspace."
      />
      <div className="space-y-6">
        <StatusCard />
        {workspaceId ? (
          <>
            <WorkspaceCard workspaceId={workspaceId} />
            <ActivityCard workspaceId={workspaceId} />
          </>
        ) : (
          <Card title="Workspace">
            <p className="text-sm text-muted">Your account does not belong to a workspace yet.</p>
          </Card>
        )}
      </div>
    </>
  );
}
