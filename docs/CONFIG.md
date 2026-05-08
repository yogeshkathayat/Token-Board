# Configuration reference

All configuration is via environment variables passed into the API container. The `infra/.env.example` file documents the same set; this page is the canonical reference.

## Required

| Var | Description |
|---|---|
| `PUBLIC_URL` | Public origin of this deployment, no trailing slash. Used in OIDC redirect URIs and CORS. |
| `DATABASE_URL` | Postgres connection string. Internal `db` service in the default compose: `postgres://tokenboard:${DB_PASSWORD}@db:5432/tokenboard`. |
| `JWT_SECRET` | HS256 signing key. ≥ 32 random bytes. Generate with `openssl rand -base64 48`. |

## Auth

| Var | Default | Description |
|---|---|---|
| `OIDC_ISSUER` | _(empty)_ | OIDC discovery URL. Leave empty to disable SSO. Examples: `https://accounts.google.com`, `https://your-tenant.okta.com`. |
| `OIDC_CLIENT_ID` | _(empty)_ | IdP-issued client identifier. |
| `OIDC_CLIENT_SECRET` | _(empty)_ | IdP-issued secret. |
| `OIDC_REDIRECT_URI` | _(empty)_ | Always `${PUBLIC_URL}/api/v1/auth/oidc/callback`. Must match exactly what's registered with the IdP. |
| `ALLOWED_EMAIL_DOMAINS` | _(empty)_ | Comma-separated CSV. When set, only users with these email domains can sign up or sign in (applies to both OIDC and password). Empty = any domain allowed. |
| `BOOTSTRAP_ADMIN_EMAIL` | _(empty)_ | First user with this email is promoted to admin on creation. Lowercase. |
| `ALLOW_PASSWORD_SIGNUP` | `true` | Set to `false` if you want to force OIDC and disable email/password registration. Existing password accounts still work. |

## Tunables

| Var | Default | Description |
|---|---|---|
| `JWT_TTL_SECONDS` | `3600` (1 h) | Lifetime of the access token. |
| `REFRESH_TTL_SECONDS` | `2592000` (30 days) | Lifetime of refresh-token cookies. |
| `LINK_CODE_TTL_SECONDS` | `600` (10 min) | Lifetime of CLI link codes. |
| `USAGE_MAX_DAYS` | `800` | Maximum date range (days) for read endpoints. Prevents runaway queries. |
| `SLOW_QUERY_MS` | `2000` | Log threshold (ms) for slow-query warnings. |
| `LEADERBOARD_REFRESH_DISABLED` | `false` | Disable the in-process leaderboard cron — useful when running multiple API replicas where only one should refresh. |

## Rate limits

Per-IP for auth, per-device for ingest.

| Var | Default | Description |
|---|---|---|
| `AUTH_RATE_MAX` | `60` | Max auth requests per window per IP. |
| `AUTH_RATE_WINDOW_MS` | `3600000` (1 h) | Auth rate-limit window. |
| `INGEST_RATE_MAX` | `300` | Max ingest requests per window per device. |
| `INGEST_RATE_WINDOW_MS` | `60000` (1 min) | Ingest rate-limit window. |

## Ports + logging

| Var | Default | Description |
|---|---|---|
| `PORT` | `3000` | Internal API port (proxy translates external `:443` → here). |
| `HOST` | `0.0.0.0` | API bind host. |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Pino log level. |
| `NODE_ENV` | _(unset)_ | Set to `production` in compose. Affects logging and cookie security flags. |

## Infra-only (compose env, not API env)

| Var | Default | Description |
|---|---|---|
| `DB_PASSWORD` | _(required)_ | Postgres password. |
| `DB_USER` | `tokenboard` | Postgres role. |
| `DB_NAME` | `tokenboard` | Postgres database. |
| `ORG` | `tokenboard` | Image namespace for `ghcr.io/${ORG}/tokenboard-*`. |
| `VERSION` | `latest` | Image tag. |
| `INGEST_BEARER_HASH` | `true` | When true, nginx hashes the device-token Bearer before forwarding to the API (defense in depth — the API also hashes it server-side). |
| `TLS_DISABLED` | `false` | Skip TLS in nginx (for local dev or when TLS is terminated elsewhere). |

## Generating secrets

```bash
# JWT_SECRET
openssl rand -base64 48

# DB_PASSWORD
openssl rand -base64 32
```

Store these in your secret manager of choice (1Password, Vault, AWS Secrets Manager, …) and inject into `.env` at deploy time. Don't commit `.env`.
