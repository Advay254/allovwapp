import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { RenameBodySchema, WorkspaceParamsSchema, WorkspaceSchema } from '@allov/shared';
import { recordAudit } from '../audit/audit-service.js';
import { authenticate, requireAuth } from '../http/auth-hook.js';
import type { AppContext } from '../lib/context.js';
import { getWorkspaceForMember, renameWorkspace } from './workspace-service.js';

export function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext): void {
  const r = app.withTypeProvider<TypeBoxTypeProvider>();
  const guard = authenticate(ctx);

  r.get(
    '/workspaces/:id',
    {
      onRequest: guard,
      schema: { params: WorkspaceParamsSchema, response: { 200: WorkspaceSchema } },
    },
    async (request) => {
      const auth = requireAuth(request);
      return getWorkspaceForMember(ctx.database.db, auth.userId, request.params.id);
    },
  );

  r.patch(
    '/workspaces/:id',
    {
      onRequest: guard,
      schema: {
        params: WorkspaceParamsSchema,
        body: RenameBodySchema,
        response: { 200: WorkspaceSchema },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const db = ctx.database.db;
      const { workspace, previousName } = await renameWorkspace(
        db,
        auth.userId,
        request.params.id,
        request.body.name,
      );
      await recordAudit(
        db,
        {
          workspaceId: workspace.id,
          actorUserId: auth.userId,
          action: 'workspace.renamed',
          targetType: 'workspace',
          targetId: workspace.id,
          metadata: { actor: auth.username, from: previousName, to: workspace.name },
          requestId: request.id,
          ip: request.ip,
        },
        request.log,
      );
      return workspace;
    },
  );
}
