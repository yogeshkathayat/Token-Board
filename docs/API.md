# API reference

All endpoints live under `/api/v1` and return JSON. Errors return `{ error: string, message?: string }` with an appropriate HTTP status.

Token columns are serialized as **strings** (decimal digits) to avoid JS Number precision loss. Parse them with `BigInt(...)`.

## Auth model

Two distinct token types:

- **User JWT** (`Authorization: Bearer eyJ...`) — issued by `/auth/login`, `/auth/oidc/callback`, `/auth/refresh`. HS256, 1h TTL by default.
- **Device token** (`Authorization: Bearer <opaque>`) — issued by `/auth/device-token` or `/auth/link-code-exchange`. Long-lived, sha256-hashed server-side.

The API distinguishes the two by token shape: a JWT has 3 dot-separated segments, a device token does not.

## `/auth`

### `GET /auth/config`
Public. Returns configuration the dashboard needs to render the login page.
```json
{ "oidc_enabled": true, "password_signup": true, "allowed_email_domains": [] }
```

### `POST /auth/signup`
Public. Returns `{ access_token, user }` and sets the `ut_refresh` cookie. 409 on duplicate email, 403 if domain not allowed.
```json
{ "email": "you@acme.com", "password": "≥8 chars", "display_name": "optional" }
```

### `POST /auth/login`
Public. Returns the same shape as signup.

### `POST /auth/refresh`
Reads the `ut_refresh` cookie and rotates it (rotation invalidates the old token). Returns `{ access_token, user }`.

### `POST /auth/logout`
Revokes the refresh token and clears the cookie.

### `GET /auth/oidc/start`
Public. Redirects to the IdP's authorize URL with state + PKCE.

### `GET /auth/oidc/callback?code&state`
Completes the OIDC flow and redirects to `${PUBLIC_URL}/auth/callback#access_token=...`.

### `GET /auth/me`
**User JWT.** Returns `{ user }`.

### `POST /auth/device-token`
**User JWT.** Mints a device token for the calling user. Body: `{ device_name?, platform? }`. Response: `{ device_id, token, created_at }`. The token is shown once and never again — store it on the device.

### `POST /auth/link-code-init`
**User JWT.** Issues a 6-character link code valid for 10 minutes (configurable). Used by the dashboard's "Devices" page. Response: `{ link_code, expires_at }`.

### `POST /auth/link-code-exchange`
Public. CLI calls this to swap a link code for a device token without ever holding a user JWT.
```json
{ "link_code": "ABCDEF", "request_id": "host-ts-rand", "device_name": "yogesh-mbp", "platform": "darwin" }
```
Response: `{ token, device_id, user_id }`. 404 if not found, 400 if expired, 409 if already used.

## Ingest

### `POST /ingest`
**Device token.** Idempotently upsert half-hour buckets. The hash header `x-tokenboard-device-token-hash` from the proxy is preferred when present.

```json
{
  "hourly": [
    {
      "hour_start": "2026-05-07T10:30:00.000Z",
      "source": "claude",
      "model": "claude-opus-4",
      "input_tokens": 1234,
      "cached_input_tokens": 0,
      "cache_creation_input_tokens": 0,
      "output_tokens": 567,
      "reasoning_output_tokens": 0,
      "total_tokens": 1801,
      "conversation_count": 1
    }
  ],
  "device_subscriptions": [
    { "tool": "claude", "provider": "anthropic", "product": "subscription", "plan_type": "max" }
  ]
}
```

Rules:
- `hour_start` MUST be a UTC half-hour boundary (`:00:00.000Z` or `:30:00.000Z`).
- `source` MUST be one of `claude | codex | gemini | opencode | kiro | cursor | copilot | openrouter`.
- Negative or non-finite numbers are clamped to `0`.
- Values > 1 trillion are clamped (defensive against bugs in parsers).
- Buckets are deduped client-side by `(source|model|hour_start)` before insert.
- Server upserts on `(user_id, device_id, source, model, hour_start)`.

Response: `{ success: true, inserted: number, skipped: number }`.

### `POST /sync-ping`
**Device token.** Records a heartbeat so the server can distinguish "no usage" from "unsynced". Response: `{ success: true, last_sync_at }`.

## Reads

All read endpoints accept `tz` (IANA, e.g. `America/Los_Angeles`) or `tz_offset_minutes` (fixed). When omitted, dates are interpreted in UTC.

### `GET /usage/summary?from&to&source&model&tz`
**User JWT.** Aggregate token totals over a date range. Returns `{ from, to, days, totals: { ... } }` where `totals` are bigint-as-strings.

### `GET /usage/daily?from&to&source&model&tz`
**User JWT.** Day-by-day breakdown.

### `GET /usage/hourly?day&source&model&tz`
**User JWT.** Half-hour buckets within a single local day.

### `GET /usage/monthly?months=1..24&to&source&model&tz`
**User JWT.** Monthly aggregates, default last 24 months.

### `GET /usage/heatmap?weeks=1..104&week_starts_on=sun|mon&tz`
**User JWT.** Per-day totals for a GitHub-style activity grid.

### `GET /usage/model-breakdown?from&to&source&tz`
**User JWT.** Per-source × per-model aggregates.

### `GET /usage/limits`
**User JWT.** Latest reported subscription markers (from `device_subscriptions` on ingest). Shape: `{ subscriptions: Array<{ tool, provider, product, plan_type, rate_limit_tier, observed_at }> }`.

## Leaderboard

### `GET /leaderboard?period=week|month|total&metric=all|claude|gpt|other&limit=1..100&offset=0..10000`
Public (auth optional). Returns ranked users for the period. Anonymous requests get only public profile data; authenticated requests additionally get a `me` block.

```json
{
  "period": "week",
  "metric": "all",
  "from": "2026-05-03",
  "to": "2026-05-09",
  "page": 1,
  "limit": 20,
  "offset": 0,
  "total_entries": 42,
  "total_pages": 3,
  "entries": [
    {
      "user_id": "uuid|null",
      "rank": 1,
      "is_me": false,
      "is_public": true,
      "display_name": "Yogesh",
      "avatar_url": null,
      "gpt_tokens": "0",
      "claude_tokens": "1234567",
      "other_tokens": "0",
      "total_tokens": "1234567"
    }
  ],
  "me": { "rank": 7, "total_tokens": "12345", ... }
}
```

### `GET /leaderboard/profile?user_id&period=week|month|total`
Public for users with `public_visibility.enabled=true`. Self-access is always allowed. 404 if the user isn't public.

### `POST /leaderboard/refresh?period=week|month|total`
**Admin only.** Force-refresh snapshots. Without `?period`, refreshes all three.

## Visibility

### `GET /public-visibility`
**User JWT.** Current state.

### `POST /public-visibility`
**User JWT.** `{ enabled, anonymous?, display_name? }`. Setting `enabled=false` revokes immediately.

## Admin

All under `/admin`, require `role=admin`.

- `GET /admin/users?search&limit&offset`
- `GET /admin/devices?user_id`
- `POST /admin/devices/:id/revoke`
- `GET /admin/stats`

## Rate limits

| Endpoint group | Default |
|---|---|
| `/auth/*` | 60 / hour / IP |
| `/ingest` | 300 / minute / device |
| Other | unlimited (auth required) |

429 responses include a `Retry-After` header.

## CORS

The API allows credentials from `PUBLIC_URL` only. Other origins receive 403.
