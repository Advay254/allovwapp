import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CircleUser, LogOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrfSecret } from '../lib/api';
import { runtimeConfig } from '../lib/config';
import { Button } from './button';

export function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      setCsrfSecret(null);
      queryClient.clear();
      navigate(`${runtimeConfig().prefix}/login`, { replace: true });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink hover:bg-canvas"
      >
        <CircleUser className="h-5 w-5" aria-hidden="true" />
        <span className="hidden max-w-32 truncate sm:inline">{username}</span>
        <span className="sr-only sm:hidden">Account menu for {username}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border border-line bg-surface p-3 shadow-pop"
        >
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate font-mono text-sm text-ink">{username}</p>
          <Button
            variant="secondary"
            icon={LogOut}
            loading={signOut.isPending}
            className="mt-3 w-full"
            onClick={() => signOut.mutate()}
          >
            Sign out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
