import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export type Tone = 'info' | 'warning' | 'danger' | 'success';

const STYLES: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'border-accent bg-soft-info', icon: 'text-link', Icon: Info },
  warning: { box: 'border-warn bg-soft-warn', icon: 'text-warn', Icon: TriangleAlert },
  danger: { box: 'border-danger bg-soft-danger', icon: 'text-danger', Icon: CircleAlert },
  success: { box: 'border-ok bg-soft-ok', icon: 'text-ok', Icon: CircleCheck },
};

/** Body text is always ink. The icon and the border carry the tone, never colour alone. */
export function Banner({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
}) {
  const { box, icon, Icon } = STYLES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-md border-l-4 p-4 text-ink ${box}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        {children ? <div className="mt-1 text-muted">{children}</div> : null}
      </div>
    </div>
  );
}
