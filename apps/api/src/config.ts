/**
 * Centralized config loaded from process.env. Throws on missing required vars
 * so misconfiguration fails fast at boot, not on first request.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: int('PORT', 3000),
  host: process.env.HOST ?? '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Auth
  oidcIssuer: process.env.OIDC_ISSUER ?? '',
  oidcClientId: process.env.OIDC_CLIENT_ID ?? '',
  oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? '',
  oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? '',
  allowedEmailDomains: allowedDomains,
  bootstrapAdminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').toLowerCase() || null,
  allowPasswordSignup: bool('ALLOW_PASSWORD_SIGNUP', true),

  // Tunables
  slowQueryMs: int('SLOW_QUERY_MS', 2000),
  usageMaxDays: int('USAGE_MAX_DAYS', 800),
  jwtTtlSeconds: int('JWT_TTL_SECONDS', 60 * 60),
  refreshTtlSeconds: int('REFRESH_TTL_SECONDS', 60 * 60 * 24 * 30),
  linkCodeTtlSeconds: int('LINK_CODE_TTL_SECONDS', 600),
  leaderboardRefreshDisabled: bool('LEADERBOARD_REFRESH_DISABLED', false),

  // Rate limits
  authRateMax: int('AUTH_RATE_MAX', 60),
  authRateWindowMs: int('AUTH_RATE_WINDOW_MS', 60 * 60 * 1000),
  ingestRateMax: int('INGEST_RATE_MAX', 300),
  ingestRateWindowMs: int('INGEST_RATE_WINDOW_MS', 60 * 1000),
} as const;

export function isOidcConfigured(): boolean {
  return Boolean(config.oidcIssuer && config.oidcClientId && config.oidcClientSecret);
}
