# PR draft — TokenBoard: company-local token-usage tracker (first cut)

> Draft only. Opening the PR and deploying are deliberately left to a human.
> Branch: `feat/company-local-tokenboard` → `main`

## What & why

Rebuilds `tokenboard` as a **company-internal, self-hostable** AI token-usage tracker for
Mumzworld — the global TokenTracker sends data to a shared cloud; this keeps everything on
infra we deploy, scoped to `@mumzworld.com`. Three surfaces + shared contract:

- **`apps/web`** — Dockerized Next.js backend: auth + ingest API + company leaderboard + dashboard UI
- **`apps/cli`** — `tokenboard-cli` local collector for Claude / Codex / Gemini / Kiro / OpenCode / Cursor
- **`apps/menubar`** — native macOS menu bar widget
- **`packages/contract`** + **`infra`** — ingest contract; Dockerfile + compose

Built on `NextDeskStarterKit` (UI + auth client) with the data model ported from
`TokenTrackerAPI`. Privacy invariant preserved: **only token counts + timestamps are collected**,
never prompts, responses, or filenames (enforced structurally + tested).

## How it works

```
AI tools → CLI parsers → ~/.tokenboard/queue.jsonl → POST /api/ingest (device token)
  → Postgres tb_usage_buckets → 5-min cron → tb_leaderboard_snapshots → dashboard + leaderboard
```

Auth: browser users via Auth Desk SSO (currently `AUTH_BYPASS` for dev; integration point wired
for later). CLI uses long-lived hashed **device tokens**, paired via a 6-char **link code** minted
in the dashboard.

## Verification

- Web: typecheck ✅ · `next build` (standalone) ✅ · unit tests 10/10 ✅
- CLI: tests 27/27 ✅ (parser token-capture + **no-content** privacy + incrementality)
- Contract parity: 5/5 ✅
- Menu bar: compiles with `swiftc`; install/uninstall verified
- Docker: `docker compose config` validates
- ⚠️ Live DB end-to-end (ingest→leaderboard round-trip) **not run** — Docker daemon was
  unavailable in the build environment. Run `cd infra && cp .env.example .env && docker compose up --build`
  then exercise `/api/ingest` → `/api/leaderboard` before merging.

## Review pass (findings fixed in this PR)

Security: prod auth-bypass guard; CSPRNG + atomic link codes; constant-time refresh secret +
debounce; removed unauthenticated `/api/dev-tools`; no cookie/session logging.
Correctness: timezone-correct usage summary; transactional + deterministic leaderboard refresh;
day-boundary-tolerant reads. Deploy: plain-Node migrations in the runner; fixed entrypoint COPY;
fail-fast compose secrets; CLI queue compaction.

## Not in this PR (follow-ups)

- Live DB E2E run + a CI job for it
- kimicode / kilo-cli / kilocode parsers; real Auth Desk SSO wiring; device-flow (SSH) auth
- Security response headers (CSP/HSTS), dedicated rate limiting, `cursors.buckets` pruning
- The opencode `time_updated` cursor edge case; gemini in-place-shrink guard

## Deploy (human-gated)

```bash
cd infra && cp .env.example .env      # set POSTGRES_PASSWORD, NEXTAUTH_SECRET, LEADERBOARD_REFRESH_SECRET
docker compose up --build -d          # ships an INSECURE demo (AUTH_BYPASS) until Auth Desk is wired
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
