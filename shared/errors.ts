/** Stable error codes. The message is the default text shown to people. */
export const ERROR_CODES = {
  validation_failed: {
    status: 400,
    message: 'The request was not valid. Check the fields and try again.',
  },
  unauthenticated: {
    status: 401,
    message: 'You are not signed in, or your session has ended. Sign in again.',
  },
  invalid_credentials: { status: 401, message: 'The username or password is not correct.' },
  csrf_failed: {
    status: 403,
    message: 'The request could not be verified. Reload the page and try again.',
  },
  forbidden: { status: 403, message: 'Your role does not allow this action.' },
  not_found: { status: 404, message: 'That item was not found.' },
  payload_too_large: { status: 413, message: 'The request is too large.' },
  too_many_attempts: {
    status: 429,
    message: 'Too many failed sign in attempts. Wait before trying again.',
  },
  rate_limited: { status: 429, message: 'Too many requests. Slow down and try again shortly.' },
  internal_error: {
    status: 500,
    message: 'Something went wrong on the server. Try again, and report the request id if it continues.',
  },
  database_unavailable: {
    status: 503,
    message: 'The database is not ready yet. Try again in a moment.',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
