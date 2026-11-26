import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type PillTone = 'ok' | 'warn' | 'bad' | 'neutral';

const TONES: Record<PillTone, { color: string; Icon: typeof Info }> = {
  ok: { color: 'text-ok', Icon: CircleCheck },
  warn: { color: 'text-warn', Icon: TriangleAlert },
  bad: { color: 'text-danger', Icon: CircleAlert },
  neutral: { color: 'text-muted', Icon: Info },
};

/** Status is always an icon plus words, never colour alone. */
export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const { color, Icon } = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </span>
  );
}
