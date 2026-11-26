export const APP_VERSION = '1.0.0';

export const PRODUCT_NAME = 'AllovWapp';
export const TAGLINE = 'One gateway. Every integration.';
export const PARENT_BRAND = 'By Allovity';
export const PUBLIC_DESCRIPTION =
  'AllovWapp is becoming a WhatsApp developer platform that connects messaging sessions to your applications through a REST API and a dashboard. It is in development and is not available yet.';

export const API_PREFIX = '/api/v1';
export const CSRF_HEADER = 'X-Allov-CSRF';
export const REQUEST_ID_HEADER = 'X-Allov-Request-Id';
export const SESSION_COOKIE_SECURE = '__Host-allov_session';
export const SESSION_COOKIE_PLAIN = 'allov_session';

export const SESSION_TTL_SECONDS = 6 * 60 * 60;
export const LOGIN_MAX_FAILURES = 5;

export const WORKSPACE_ROLES = ['owner', 'admin', 'developer', 'read_only'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Dashboard routes that exist, relative to the admin path prefix. */
export const DASHBOARD_PATHS = ['', '/login', '/settings'] as const;
