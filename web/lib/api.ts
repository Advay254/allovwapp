import { API_PREFIX, CSRF_HEADER, type ApiErrorBody } from '@allov/shared';

// The CSRF secret lives only in memory. Nothing is written to browser storage.
let csrfSecret: string | null = null;

export function setCsrfSecret(value: string | null): void {
  csrfSecret = value;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readError(response: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let message = 'Something went wrong. Try again.';
  let requestId: string | null = response.headers.get('X-Allov-Request-Id');
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      code = body.error.code;
      message = body.error.message;
      requestId = body.error.requestId || requestId;
    }
  } catch {
    /* The body was not JSON. The defaults above apply. */
  }
  const retry = Number(response.headers.get('Retry-After'));
  return new ApiError(
    response.status,
    code,
    message,
    requestId,
    Number.isFinite(retry) && retry > 0 ? retry : null,
  );
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method !== 'GET' && csrfSecret) headers[CSRF_HEADER] = csrfSecret;
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the server. Check your connection and try again.',
      null,
      null,
    );
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
