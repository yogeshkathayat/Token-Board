# Changelog

## 0.1.0 — TokenBoard first cut (unreleased)

Company-internal, self-hostable AI token-usage tracker — a single-tenant system for monitoring AI coding-assistant token consumption across your engineering team. Built on Next.js 16 for UI + auth, with a streamlined data model for half-hour bucketing and leaderboard ranking.

### Added
- **`apps/web`** — Next.js 16 (App Router) app that is the Dockerized backend:
  - Ingest API `POST /api/ingest` (device-token auth, half-hour bucket validation, batch upsert)
  - Company leaderboard `GET /api/leaderboard` + `POST /api/leaderboard/refresh` (5-min cron)
  - Personal usage `GET /api/usage/summary` + `GET /api/usage/heatmap` (timezone-aware)
  - Device pairing: `POST /api/device-token` + `POST /api/link-code/init|exchange`
  - Dashboard, company leaderboard, and connect-device pages (shadcn/ui, Recharts, TanStack Table)
  - Postgres schema (`tb_*` tables), idempotent migrations, bigint-as-string serialization
  - Email-domain scoping via `ALLOWED_EMAIL_DOMAINS`; `AUTH_BYPASS` dev auth + Auth Desk SSO integration point
- **`apps/cli`** — `tokenboard-cli` collector (Node 20, CommonJS):
  - Parsers: **claude, codex, gemini** (full incremental file-tail); **kiro, opencode**
    (best-effort SQLite, skip when absent); **cursor** (wired, inert — needs remote auth)
  - Half-hour bucketing, append-only queue with compaction, throttled idempotent uploader
  - `init` / `device-login` (link-code) / `sync` / `autosync` / `status` / `config`
  - Privacy invariant: only token counts + timestamps are ever uploaded
- **`apps/menubar`** — native macOS menu bar app (SwiftUI/AppKit, `swiftc` + launchd)
  - Local-first: reads `~/.tokenboard/summary.json` (written by CLI), no server auth, works offline
- **`packages/contract`** — CLI↔web ingest contract twins + parity test
- **`infra`** — multi-stage Dockerfile (pnpm, standalone, plain-Node migrations) +
  docker-compose (web + postgres) + fail-fast secret config

### Security & correctness (pre-merge review pass)
- `AUTH_BYPASS` is ignored in production unless `AUTH_BYPASS_ALLOW_IN_PROD=true`
- Link codes: CSPRNG + atomic single-use consumption
- Leaderboard refresh is transactional with deterministic ranking; reads tolerate day-boundary skew
- Timezone-correct usage summary (was broken for non-UTC users)
- Constant-time refresh-secret compare + debounce; no cookie/session logging

### Known gaps (see repo README / handoff)
- Live DB end-to-end not run in this environment (Docker daemon unavailable)
- Deferred: kimicode / kilo-cli / kilocode parsers; real Auth Desk SSO wiring; device-flow auth
- Deferred hardening: security response headers, dedicated rate limiting, cursor.buckets pruning
