import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { WorkspaceDto } from '@allov/shared';
import { Banner } from '../components/banner';
import { Button } from '../components/button';
import { Card } from '../components/card';
import { ErrorBlock } from '../components/error-block';
import { TextField } from '../components/field';
import { CardSkeleton } from '../components/skeleton';
import { ApiError, api } from '../lib/api';

export function SettingsWorkspace({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<WorkspaceDto>(`/workspaces/${workspaceId}`),
  });
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (workspace.data) setName(workspace.data.name);
  }, [workspace.data]);

  const rename = useMutation({
    mutationFn: (next: string) => api.patch<WorkspaceDto>(`/workspaces/${workspaceId}`, { name: next }),
    onSuccess: (data) => {
      queryClient.setQueryData(['workspace', workspaceId], data);
      void queryClient.invalidateQueries({ queryKey: ['audit', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['session'] });
      setSaved(true);
    },
  });

  const trimmed = name.replace(/\s+/g, ' ').trim();
  const fieldError =
    trimmed.length === 0
      ? 'Enter a workspace name.'
      : trimmed.length > 60
        ? 'Use 60 characters or fewer.'
        : null;
  const canEdit = workspace.data?.role === 'owner' || workspace.data?.role === 'admin';
  const unchanged = trimmed === workspace.data?.name;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (fieldError || unchanged || !canEdit) return;
    setSaved(false);
    rename.mutate(trimmed);
  };

  return (
    <Card title="Workspace" description="The name shown in the sidebar and in the activity list.">
      {workspace.isPending ? (
        <CardSkeleton rows={2} />
      ) : workspace.isError ? (
        <ErrorBlock error={workspace.error} onRetry={() => void workspace.refetch()} />
      ) : (
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <TextField
            label="Workspace name"
            name="workspaceName"
            value={name}
            maxLength={80}
            disabled={!canEdit}
            error={canEdit && name !== workspace.data.name ? fieldError : null}
            helper={canEdit ? undefined : 'Only owners and admins can rename the workspace.'}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
              rename.reset();
            }}
          />
          <div aria-live="polite">
            {saved ? <Banner tone="success" title="Workspace renamed" /> : null}
            {rename.error instanceof ApiError ? (
              <Banner tone="danger" title={rename.error.message}>
                {rename.error.requestId ? `Request id ${rename.error.requestId}` : undefined}
              </Banner>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="submit"
              icon={Save}
              loading={rename.isPending}
              disabled={Boolean(fieldError) || unchanged}
            >
              Save name
            </Button>
          ) : null}
        </form>
      )}
    </Card>
  );
}
