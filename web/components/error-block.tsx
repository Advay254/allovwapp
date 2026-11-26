import { RefreshCw } from 'lucide-react';
import { ApiError } from '../lib/api';
import { Button } from './button';

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Try again in a moment.';
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <div role="alert" className="rounded-md border-l-4 border-danger bg-soft-danger p-4 text-ink">
      <p className="text-sm font-medium">{message}</p>
      {requestId ? (
        <p className="mt-1 text-sm text-muted">
          Request id <span className="font-mono text-xs">{requestId}</span>
        </p>
      ) : null}
      <Button variant="secondary" icon={RefreshCw} className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
