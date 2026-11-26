import { APP_VERSION, type StatusDto } from '@allov/shared';
import type { AppContext } from '../lib/context.js';

export function getSystemStatus(ctx: AppContext): StatusDto {
  const state = ctx.database.state;
  return {
    version: APP_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: state.status,
      lastCheckAt: state.lastCheckAt ? state.lastCheckAt.toISOString() : null,
      reason: state.reason,
    },
    warnings: ctx.configWarnings,
  };
}
