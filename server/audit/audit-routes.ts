import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AuditPageSchema, AuditQuerySchema, WorkspaceParamsSchema } from '@allov/shared';
import { authenticate, requireAuth } from '../http/auth-hook.js';
import { AppError } from '../lib/app-error.js';
import type { AppContext } from '../lib/context.js';
import { getMemberRole } from '../workspaces/workspace-service.js';
import { listAudit } from './audit-service.js';

export function registerAuditRoutes(app: FastifyInstance, ctx: AppContext): void {
  const r = app.withTypeProvider<TypeBoxTypeProvider>();

  r.get(
    '/workspaces/:id/audit',
    {
      onRequest: authenticate(ctx),
      schema: {
        params: WorkspaceParamsSchema,
        querystring: AuditQuerySchema,
        response: { 200: AuditPageSchema },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const db = ctx.database.db;
      const role = await getMemberRole(db, auth.userId, request.params.id);
      if (!role) throw new AppError('not_found');
      return listAudit(
        db,
        request.params.id,
        request.query.page ?? 1,
        request.query.pageSize ?? 20,
      );
    },
  );
}
