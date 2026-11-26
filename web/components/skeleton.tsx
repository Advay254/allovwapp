export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-line ${className}`} />;
}

/** Keeps the layout stable while data loads, so nothing jumps when it arrives. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full max-w-sm" />
      ))}
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div role="status" aria-label="Loading the dashboard" className="min-h-screen bg-canvas">
      <div className="flex h-14 items-center border-b border-line bg-surface px-4">
        <Skeleton className="h-7 w-36" />
      </div>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
