import { ERROR_CODES, type ErrorCode } from '@allov/shared';

export interface AppErrorOptions {
  message?: string;
  headers?: Record<string, string>;
  statusCode?: number;
}

/** The only error type that is allowed to reach people. Everything else becomes internal_error. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly headers: Record<string, string>;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? ERROR_CODES[code].message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode ?? ERROR_CODES[code].status;
    this.headers = options.headers ?? {};
  }
}
