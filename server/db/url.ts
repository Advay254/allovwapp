const SSL_PARAMS_PATTERN = /^(ssl.*|uselibpqcompat)$/i;

function parameterName(part: string): string {
  const raw = part.split('=')[0] ?? '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Removes every ssl related query parameter from a connection string.
 * The node pg driver lets the parsed URL override explicit options, so a stray
 * sslmode in the URL would silently undo DATABASE_SSL. Encryption is controlled
 * only through DATABASE_SSL and DATABASE_CA_CERT.
 */
export function sanitizeConnectionString(raw: string): string {
  const value = raw.trim();
  const q = value.indexOf('?');
  if (q === -1) return value;
  const base = value.slice(0, q);
  const kept = value
    .slice(q + 1)
    .split('&')
    .filter((part) => part !== '' && !SSL_PARAMS_PATTERN.test(parameterName(part)));
  return kept.length > 0 ? `${base}?${kept.join('&')}` : base;
}

export function hasSslParams(raw: string): boolean {
  return sanitizeConnectionString(raw) !== raw.trim();
}
