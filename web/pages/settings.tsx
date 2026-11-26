import { PageHeader } from '../components/page-header';
import { useSession } from '../lib/session';
import { Card } from '../components/card';
import { SettingsSecurity } from './settings-security';
import { SettingsWorkspace } from './settings-workspace';

export function SettingsPage() {
  const session = useSession();
  const workspaceId = session.data?.workspaces[0]?.id;
  return (
    <>
      <PageHeader title="Settings" helper="Manage your workspace and the places you are signed in." />
      <div className="space-y-6">
        {workspaceId ? (
          <SettingsWorkspace workspaceId={workspaceId} />
        ) : (
          <Card title="Workspace">
            <p className="text-sm text-muted">Your account does not belong to a workspace yet.</p>
          </Card>
        )}
        <SettingsSecurity />
      </div>
    </>
  );
}
