# Security model

## Privacy invariant

`tokenboard` captures and stores **token counts and timestamps only** — never prompt content, response content, file contents, or filenames. This is the project's foundational privacy rule. Every contribution to a parser must preserve it.

Enforcement happens at three layers:

1. **Parser code** — `apps/cli/src/parsers/*.js` only reads token-count fields from each tool's logs. Code review must reject any parser that touches message bodies.
2. **Tests** — parser tests assert that bucket payloads contain only the documented fields.
3. **Bucket schema** — the `UsageBucket` type in `@tokenboard/shared/types` does not have a field for content; even if a parser tried to bundle text, it couldn't get past `ingest` validation.

If you find a parser that violates this invariant, file an issue or open a PR — it's a critical bug.

## Threat model

This service is **internal company tooling**, not a multi-tenant SaaS. Threats we defend against:

| Threat | Mitigation |
|---|---|
| Casual exfiltration via leaked device token | Server stores only the sha256 hash; nginx hashes Bearer at the proxy layer (defense in depth). |
| Stolen DB backup | Refresh tokens and device tokens are stored as hashes only. Passwords are argon2id. |
| CSRF on dashboard | Auth uses bearer JWT in `Authorization` header (not cookie-only); refresh cookies are SameSite=Lax + HttpOnly + Secure (prod). |
| Cross-origin abuse | CORS allows credentials from `PUBLIC_URL` only. |
| Brute-force login | `@fastify/rate-limit` 60/hour/IP on `/auth/*`. |
| Brute-force device-token guess | Device tokens are 256-bit random; no plain enumeration possible. |
| Replay of CLI ingestion | Idempotent on `(user_id, device_id, source, model, hour_start)`; replays return `skipped` count. |
| Compromised IdP | OIDC with state + PKCE + nonce; tokens validated server-side. |

Out of scope:

- A motivated insider with DB access can read aggregated token counts for any user. The privacy invariant prevents content leaks; it does not prevent admins from seeing _that_ usage occurred.
- A malicious CLI could send fabricated buckets. Mitigation is per-device rate limiting + admin review of `/admin/devices` for anomalies. Content cannot be exfiltrated since none is ever sent.
- DoS at the network edge — that's your reverse-proxy / WAF's job (nginx + your cloud's protections).

## Secrets

| Secret | Where | Lifetime |
|---|---|---|
| `JWT_SECRET` | API container env | Forever (rotate causes mass logout) |
| `OIDC_CLIENT_SECRET` | API container env | IdP-controlled |
| User passwords | argon2id-hashed in `tb_users.password_hash` | Per user |
| Refresh tokens | sha256-hashed in `tb_sessions.refresh_token_hash` | 30 days, rotated on use |
| Device tokens | HMAC(JWT_SECRET, sha256(token))-hashed in `tb_devices.token_hash` | Forever, manual revoke |
| OpenRouter API keys (CLI-side) | OS keychain (keytar) → AES-GCM file fallback | User-controlled |

## Reporting vulnerabilities

Open a private security advisory on the repo, or email the maintainer listed in `package.json#bugs`. Include:

- Steps to reproduce
- The version of the CLI / API in use
- Whether the issue affects deployed instances or self-hosters running their own builds

Do not file public issues for unpatched vulnerabilities.
