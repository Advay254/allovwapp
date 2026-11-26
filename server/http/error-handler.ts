import type { FastifyInstance } from 'fastify';
import { ERROR_CODES } from '@allov/shared';
import { AppError } from '../lib/app-error.js';
import { describeError } from '../lib/log.js';

interface Mapped {
  status: number;
  code: string;
  message: string;
  headers: Record<string, string>;
}

interface LooseError {
  statusCode?: number;
  code?: string;
  validation?: Array<{ instancePath?: string; params?: { missingProperty?: unknown } }>;
}

function fieldName(error: LooseError): string | null {
  const first = error.validation?.[0];
  if (!first) return null;
  const missing = first.params?.missingProperty;
  const raw = typeof missing === 'string' ? missing : (first.instancePath ?? '').split('/').pop();
  const clean = (raw ?? '').replace(/[^A-Za-z0-9_]/g, '');
  return clean === '' ? null : clean;
}

/** Turns any error into the stable public shape. Library messages never pass through. */
export function mapError(err: unknown): Mapped {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, headers: err.headers };
  }
  const loose = (err ?? {}) as LooseError;
  if (loose.validation) {
    const field = fieldName(loose);
    return {
      status: 400,
      code: 'validation_failed',
      message: field ? `Check the field "${field}" and try again.` : ERROR_CODES.validation_failed.message,
      headers: {},
    };
  }
  if (loose.statusCode === 413 || loose.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return { status: 413, code: 'payload_too_large', message: ERROR_CODES.payload_too_large.message, headers: {} };
  }
  if (loose.statusCode === 415) {
    return { status: 415, code: 'validation_failed', message: 'Send the request as JSON.', headers: {} };
  }
  if (loose.statusCode === 429) {
    return { status: 429, code: 'rate_limited', message: ERROR_CODES.rate_limited.message, headers: {} };
  }
  if (typeof loose.statusCode === 'number' && loose.statusCode >= 400 && loose.statusCode < 500) {
    return { status: 400, code: 'validation_failed', message: 'The request could not be read.', headers: {} };
  }
  return { status: 500, code: 'internal_error', message: ERROR_CODES.internal_error.message, headers: {} };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((err, request, reply) => {
    const mapped = mapError(err);
    if (mapped.status >= 500) {
      request.log.error({ err: describeError(err) }, 'Request failed');
    }
    for (const [name, value] of Object.entries(mapped.headers)) reply.header(name, value);
    void reply.status(mapped.status).type('application/json; charset=utf-8').send({
      error: { code: mapped.code, message: mapped.message, requestId: request.id },
    });
  });
}
