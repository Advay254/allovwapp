import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  helper?: string;
  error?: string | null;
}

export function TextField({ label, helper, error, className = '', ...rest }: TextFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted disabled:bg-canvas disabled:text-muted"
        {...rest}
      />
      {helper ? (
        <p id={helperId} className="mt-1 text-sm text-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
