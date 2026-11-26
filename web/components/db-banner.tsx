import { useQuery } from '@tanstack/react-query';
import { Banner } from './banner';

interface Health {
  status: string;
  database: 'connecting' | 'ready' | 'error';
  databaseReason?: string;
}

/** Shows a banner while the database is not ready. It reads the real /health endpoint. */
export function DbBanner() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<Health> => {
      const response = await fetch('/health', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('health check failed');
      return (await response.json()) as Health;
    },
    refetchInterval: 15_000,
  });

  if (health.isError) {
    return (
      <div className="px-4 pt-4 md:px-6">
        <Banner tone="danger" title="The server cannot be reached">
          Check your connection. This page will keep trying.
        </Banner>
      </div>
    );
  }
  if (!health.data || health.data.database === 'ready') return null;
  const connecting = health.data.database === 'connecting';
  return (
    <div className="px-4 pt-4 md:px-6">
      <Banner
        tone="warning"
        title={connecting ? 'Connecting to the database' : 'The database is not reachable'}
      >
        {connecting
          ? 'Some pages will not load until the connection is ready.'
          : `Reason: ${health.data.databaseReason ?? 'connection failed'}. The server keeps retrying.`}
      </Banner>
    </div>
  );
}
