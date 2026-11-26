export interface RuntimeConfig {
  prefix: string;
  version: string;
}

const FALLBACK: RuntimeConfig = { prefix: '/app', version: '' };
let cached: RuntimeConfig | null = null;

/** Reads the values the server put into the page, so one build works with any ADMIN_PATH. */
export function runtimeConfig(): RuntimeConfig {
  if (cached) return cached;
  try {
    const raw = document.querySelector('meta[name="allov-config"]')?.getAttribute('content');
    const parsed = JSON.parse(raw ?? '{}') as Partial<RuntimeConfig>;
    cached = {
      prefix: typeof parsed.prefix === 'string' && parsed.prefix.startsWith('/') ? parsed.prefix : FALLBACK.prefix,
      version: typeof parsed.version === 'string' ? parsed.version : FALLBACK.version,
    };
  } catch {
    cached = FALLBACK;
  }
  return cached;
}
