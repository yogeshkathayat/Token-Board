# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Build & Test Commands

```bash
# Web app (apps/web) — Next.js 16 + React 19
cd apps/web
pnpm install              # Install dependencies
pnpm dev                  # Dev server on :3000
pnpm build                # Production build (output: 'standalone')
pnpm start                # Start standalone server (node .next/standalone/server.js)
pnpm migrate              # Apply DB migrations (node scripts/migrate.mjs)
pnpm typecheck            # TypeScript check
pnpm test                 # Run tests (node --test --import tsx test)

# CLI (apps/cli) — Node 20, CommonJS
cd apps/cli
npm test                  # Run parser tests
npm link                  # Install globally for testing
node --test test/claude-parser.test.js  # Single test file

# Menu bar (apps/menubar) — Native Swift, no Xcode
cd apps/menubar
./build.sh install        # Build with swiftc + register launchd agent
./build.sh uninstall      # Remove
tail -f ~/Library/Logs/TokenBoardBar.log  # View logs

# Docker deployment
cd infra
cp .env.example .env      # Configure secrets
docker compose up --build -d
docker compose logs -f web
docker compose down
```

## Architecture

TokenBoard is a single-tenant self-hosted SaaS. Each deployment serves one organization. Four cooperating components:

```
apps/web          Next.js 16 backend + dashboard (TypeScript, ESM, pnpm)
apps/cli          tokenboard-cli npm package (Node 20, CommonJS)
apps/menubar      Native Swift macOS menu bar app
packages/contract TypeScript types + half-hour bucket helpers
```

### Data flow (read this first)

```
AI tools (Claude Code, Codex, Cursor, etc.)
   │ write to ~/.claude/projects/*.jsonl, ~/.cursor/*, etc.
   ▼
CLI parsers (apps/cli/src/parsers/*.js)
   │ incremental — each parser tracks its own cursor in ~/.tokenboard/cursors.json
   ▼
BucketAggregator → ~/.tokenboard/queue.jsonl   (NDJSON, append-only)
   │ uploaded in batches by `tokenboard sync`
   ▼
POST /api/ingest (device-token auth)
   │ idempotent upsert keyed by (user_id, device_id, source, model, hour_start)
   │ hour_start MUST be a UTC half-hour boundary (:00 or :30)
   ▼
tb_usage_buckets (Postgres)
   │ aggregated by node-cron every 5 min into
   ▼
tb_leaderboard_snapshots — pre-computed per period (week/month/total)
```

Half-hour bucketing happens **client-side** in `apps/cli/src/lib/buckets.js::halfHourFloor` and is re-validated by the API. `packages/contract` is the contract — types + boundary helpers only.

### Auth model (two distinct token types)

- **User JWT / browser session** — obtained from the external Auth Desk SSO integration point (currently deferred; `AUTH_BYPASS` provides a mock company user in dev). HS256 over `NEXTAUTH_SECRET`. Used by the dashboard. (The menu bar is local-first and does NOT use this.)
- **Device token** (`Authorization: Bearer <opaque>`) — issued by `/api/device-token` or `/api/link-code/exchange`. Long-lived, sha256-hashed server-side. Used only by the CLI for `/api/ingest`.

The auth middleware distinguishes the two by token shape (3 dot-separated segments → JWT). Routes opt in via middleware config.

**Link codes** (6-char A-Z/2-9, 10-min TTL, single-use): Dashboard mints one via `POST /api/link-code/init`; CLI exchanges via `POST /api/link-code/exchange` (public endpoint; the code is atomically consumed exactly once).

**Development bypass**: `AUTH_BYPASS=true` skips external SSO and uses a mock user (`AUTH_BYPASS_EMAIL`). On production builds (`NODE_ENV=production`), `AUTH_BYPASS` is ignored unless `AUTH_BYPASS_ALLOW_IN_PROD=true` (explicit insecure-demo acknowledgment). **Production**: Set `AUTH_BYPASS=false` and wire Auth Desk SSO or your provider.

### Database schema highlights

All tables prefixed `tb_` (token board). Schema in `apps/web/migrations/0001_init.sql`. Key invariants:

- `tb_usage_buckets` is the canonical ledger. `hour_start` MUST be a UTC half-hour boundary (:00 or :30).
- `tb_usage_buckets` is a **single table** (not partitioned in v1), indexed on `(user_id, hour_start)` and `hour_start`. `hour_start` MUST be a UTC half-hour boundary (`:00`/`:30`), validated on ingest.
- BIGINT token columns are returned to the client as **strings** (never JS Numbers) to avoid precision loss. Enforced via `pg` driver BIGINT type parser override in `apps/web/src/lib/db/index.ts`.
- `tb_leaderboard_snapshots` has one column per source (`claude_tokens`, `codex_tokens`, `cursor_tokens`, `kiro_tokens`, `gemini_tokens`, `opencode_tokens`, `other_tokens`, `total_tokens`). Adding a new source = adding a column + updating the leaderboard service + adding it to `apps/web/src/lib/contract.ts`.

### CLI parsers

`apps/cli/src/parsers/index.js` orchestrates 8 parsers, each exporting `{ source, detect, parse }`. `runAll()` calls `detect()` first to skip tools not installed; only then calls `parse()`.

Two archetypes:

- **File-tail parsers** (claude, codex, gemini) — track `(inode, byte_offset)` in `~/.tokenboard/cursors.json`. On rotate/truncate, reset to offset 0.
- **DB poll parsers** (opencode, kiro, cursor) — track a `lastRowId` or `updated_at` cursor. SQLite via the optional `better-sqlite3` peer dep — if not installed, parser silently skips.

**Adding a new parser**: write `apps/cli/src/parsers/<tool>.js` with `{source, detect, parse}`, register in `parsers/index.js`, add the source name to `apps/web/src/lib/contract.ts` (gates API ingest validation), add a `<tool>_tokens` column to `tb_leaderboard_snapshots` + the leaderboard service, write a parser test.

### Privacy invariant (read before touching parsers)

Only token *counts* and *timestamps* are uploaded. Never prompts, responses, file contents, or filenames. Enforced at three layers:

1. Parser code in `apps/cli/src/parsers/*.js` — only reads token-count fields
2. The shared `UsageBucket` type in `apps/web/src/lib/contract.ts` has no field for content
3. API ingest validation rejects unknown fields via schema validation

Code review must reject any parser that touches message bodies. This is non-negotiable.

### Timezone handling

The API stores buckets in UTC. The dashboard and menu bar widget pass `tz=IANA` (e.g., `tz=America/Los_Angeles`) on read endpoints so date boundaries align to the user's local wallclock. Without `tz`, the API defaults to UTC — which silently shifts "today" for non-UTC users.

Dashboard reads `Intl.DateTimeFormat().resolvedOptions().timeZone` once at module load, passes it everywhere. Menu bar uses `TimeZone.current.identifier` and `Calendar.date(byAdding: .day, ...)` (handles DST).

### Local CLI state

```
~/.tokenboard/
├── config.json               backend URL + device token (mode 0600)
├── queue.jsonl               pending buckets (NDJSON, append-only)
├── queue.state.json          byte offset committed
├── cursors.json              per-source incremental parse state
├── summary.json              latest usage summary (written by CLI, read by menu bar)
└── secrets/                  AES-GCM fallback keychain (Linux without keytar)
```

Override with `TOKENBOARD_HOME=/path/to/dir`. Tests use this — see `apps/cli/test/claude-parser.test.js` for the pattern (set `TEST_HOME` + `TEST_TRACKER_HOME` *at module load*, before requiring the parser).

### macOS menu bar widget

Native Swift, no Xcode project. Compiled with `swiftc -O` directly because SwiftPM's manifest-loader stack is broken on most Command Line Tools installs (PackageDescription ABI mismatch + duplicate `SwiftBridging` modulemap from interrupted updates).

If `swiftc` itself fails with "redefinition of module 'SwiftBridging'":
```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap{,.bak}
```

The Settings.swift uses a **0600 file** at `~/Library/Application Support/TokenBoard/token` for the user JWT instead of Keychain. Reason: every dev rebuild changes the unsigned binary identity, and macOS Keychain entries default to "this exact binary only" ACL → `errSecUserCanceled (-128)` on read after rebuild. Don't switch back to Keychain without first solving the unsigned-binary ACL problem (probably means proper Developer ID + notarization).

The bar app reads `~/.tokenboard/summary.json` (written by the CLI on each sync) directly — no server, no auth, works offline. The dashboard + leaderboard are server-backed.

The bar app uses `launchctl bootstrap gui/$UID` (the modern API) — `launchctl load`/`unload` is deprecated and doesn't bind to the GUI session correctly on macOS 13+, which makes `NSStatusItem` invisible.

## Operational notes

- **All migrations are idempotent** — safe to re-run `pnpm migrate`. The runner (`apps/web/scripts/migrate.mjs`) tracks applied versions in `tb_schema_migrations`.
- **Leaderboard refresh** — node-cron inside the web app runs every 5 min. Disable with `LEADERBOARD_REFRESH_DISABLED=true` for multi-replica deploys; pick one replica to run it.
- **Bootstrap user** — first user with `AUTH_BYPASS_EMAIL` or from `ALLOWED_EMAIL_DOMAINS` is auto-created on first signin.
- **Email-domain allowlist** — `ALLOWED_EMAIL_DOMAINS=acme.com,acme.io` restricts who can sign in / appear on the leaderboard. Empty = allow all (dev only).

## Conventions

- Package names: `@tokenboard/web`, `@tokenboard/contract`. CLI is `tokenboard-cli` (no scope, since it ships to npm). Bin name: `tokenboard`.
- Env-var prefix: `TOKENBOARD_*` for CLI, `NEXT_PUBLIC_*` for Next.js client-side, plain names (`DATABASE_URL`, `NEXTAUTH_SECRET`, etc.) for server.
- DB table prefix: `tb_`. Don't use `ut_` (legacy from before rename).
- Token columns in API responses: bigint-as-string. Never serialize as JS `number`.
- TS files use ESM (`"type": "module"` in web). CLI is CommonJS (`"type": "commonjs"`).
- Default to writing **no comments**. Add a comment only when a future reader would be surprised by the code — e.g. workarounds for upstream bugs (see `Settings.swift`'s Keychain comment, the launchctl bootstrap note in `build.sh`). Don't comment what the code does — name things well instead.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
