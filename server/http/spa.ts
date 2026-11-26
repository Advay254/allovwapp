import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_VERSION,
  PARENT_BRAND,
  PRODUCT_NAME,
  PUBLIC_DESCRIPTION,
  TAGLINE,
} from '@allov/shared';
import type { AppConfig } from '../config/index.js';
import { AppError } from '../lib/app-error.js';

export function findWebDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), 'web/dist'),
    resolve(here, '../../../web/dist'),
    resolve(here, '../../web/dist'),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface Spa {
  publicPage(): string;
  dashboard(): string;
  notFound(): string;
}

/**
 * Fills the built index.html with runtime values: the admin path prefix and the version go
 * into a meta tag (no inline script, so the strict CSP holds), and each page type gets its
 * own head tags. The same build therefore works with any ADMIN_PATH.
 */
export function createSpa(config: AppConfig, webDist: string | null): Spa {
  let cached: string | null = null;
  const template = (): string => {
    if (cached) return cached;
    if (!webDist) {
      throw new AppError('internal_error', { message: 'The web files have not been built yet.' });
    }
    cached = readFileSync(join(webDist, 'index.html'), 'utf8');
    return cached;
  };
  const runtime = escapeHtml(JSON.stringify({ prefix: config.adminPath, version: APP_VERSION }));
  const runtimeMeta = `<meta name="allov-config" content="${runtime}">`;
  const render = (head: string, root: string): string =>
    template()
      .replace('<!--allov:head-->', () => `${runtimeMeta}${head}`)
      .replace('<!--allov:root-->', () => root);

  const title = `${PRODUCT_NAME}: ${TAGLINE}`;
  const publicHead = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(PUBLIC_DESCRIPTION)}">`,
    `<link rel="canonical" href="${escapeHtml(config.baseUrl)}/">`,
    '<meta name="robots" content="index, follow">',
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${PRODUCT_NAME}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(PUBLIC_DESCRIPTION)}">`,
    `<meta property="og:url" content="${escapeHtml(config.baseUrl)}/">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(PUBLIC_DESCRIPTION)}">`,
  ].join('');
  const publicRoot =
    `<main><h1>${PRODUCT_NAME}</h1><p>${escapeHtml(TAGLINE)}</p>` +
    `<p>${escapeHtml(PUBLIC_DESCRIPTION)}</p><p>${escapeHtml(PARENT_BRAND)}</p></main>`;
  const privateHead = `<title>${PRODUCT_NAME}</title><meta name="robots" content="noindex, nofollow">`;
  const notFoundHead = `<title>Page not found | ${PRODUCT_NAME}</title><meta name="robots" content="noindex, nofollow">`;
  const notFoundRoot =
    '<main><h1>Page not found</h1><p>The page you asked for does not exist.</p>' +
    '<p><a href="/">Go to the home page</a></p></main>';

  return {
    publicPage: () => render(publicHead, publicRoot),
    dashboard: () => render(privateHead, ''),
    notFound: () => render(notFoundHead, notFoundRoot),
  };
}
