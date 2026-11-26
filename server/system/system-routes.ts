import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { StatusSchema } from '@allov/shared';
import { authenticate } from '../http/auth-hook.js';
import type { AppContext } from '../lib/context.js';
import { getSystemStatus } from './system-status.js';

export function registerSystemRoutes(app: FastifyInstance, ctx: AppContext): void {
  const r = app.withTypeProvider<TypeBoxTypeProvider>();

  r.get(
    '/system/status',
    { onRequest: authenticate(ctx), schema: { response: { 200: StatusSchema } } },
    async () => getSystemStatus(ctx),
  );
}
