import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentType } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const VARIANTS: Record<Variant, string> = {
  // Product green is a fill with dark text, never green text on white.
  primary: 'bg-brand text-ink hover:bg-brand-deep',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-canvas',
  danger: 'border border-danger bg-surface text-danger hover:bg-soft-danger',
};

export function Button({
  variant = 'primary',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
