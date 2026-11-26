import { useId } from 'react';

export function LogoSymbol({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M6 27V15a10 10 0 0 1 20 0v12"
        fill="none"
        stroke="var(--allov-blue)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="21" r="3.75" fill="var(--allov-green)" />
    </svg>
  );
}

/** Symbol plus the product name. The name is real text, so it scales and can be read aloud. */
export function Logo({ className = '' }: { className?: string }) {
  const id = useId();
  return (
    <span id={id} className={`inline-flex items-center gap-2 ${className}`}>
      <LogoSymbol className="h-7 w-7" />
      <span className="font-display text-lg font-bold tracking-tight text-ink">AllovWapp</span>
    </span>
  );
}
