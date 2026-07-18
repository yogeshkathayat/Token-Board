# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Build & Test Commands

```bash
# Root (monorepo)
pnpm install              # Bootstrap all workspaces
pnpm test                 # Run all tests
pnpm typecheck            # Typecheck all workspaces

# Web app (apps/web) — Next.js 16 + React 19
cd apps/web
pnpm dev                  # Dev server on :3000
pnpm build                # Production build (output: 'standalone')
pnpm start                # Start standalone server (node .next/standalone/server.js)
pnpm migrate              # Apply DB migrations (tsx src/lib/db/migrate.ts)
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

TokenBoard is a single-tenant self-hosted SaaS. Each deployment is one company (Mumzworld). Four cooperating components:

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
POST /api/v1/ingest (device-token auth)
   │ idempotent upsert keyed by (user_id, device_id, source, model, hour_start)
   │ hour_start MUST be a UTC half-hour boundary (:00 or :30)
   ▼
tb_usage_buckets (Postgres, partitioned by month)
   │ aggregated by node-cron every 5 min into
   ▼
tb_leaderboard_snapshots — pre-computed per period (week/month/total)
```

Half-hour bucketing happens **client-side** in `apps/cli/src/lib/buckets.js::halfHourFloor` and is re-validated by the API. `packages/contract` is the contract — types + boundary helpers only.

### Auth model (two distinct token types)

- **User JWT** (`Authorization: Bearer eyJ...`) — issued by `/api/auth/signin`, `/api/auth/callback/auth-desk`, etc. HS256 over `NEXTAUTH_SECRET`. Used by the dashboard and menu bar widget.
- **Device token** (`Authorization: Bearer <opaque>`) — issued by `/api/auth/device-token` or `/api/auth/link-code-exchange`. Long-lived, sha256-hashed server-side. Used only by the CLI for `/api/v1/ingest`.

The auth middleware distinguishes the two by token shape (3 dot-separated segments → JWT). Routes opt in via middleware config.

**Link codes** (6-char A-Z/2-9, 10-min TTL, single-use): Dashboard mints one via `POST /api/auth/link-code-init`; CLI exchanges via `POST /api/auth/link-code-exchange` (public endpoint, idempotent on `request_id`).

**Development bypass**: `AUTH_BYPASS=true` skips external SSO and uses a mock user (`AUTH_BYPASS_EMAIL`). **Production**: Set `AUTH_BYPASS=false` and wire Auth Desk SSO.

### Database schema highlights

All tables prefixed `tb_` (token board). Schema in `apps/web/migrations/0001_init.sql`. Key invariants:

- `tb_usage_buckets` is the canonical ledger. `hour_start` MUST be a UTC half-hour boundary.
- `tb_usage_buckets` is **partitioned by month** on `hour_start`. The API lazy-creates partitions per-request before inserts.
- BIGINT token columns are returned to the client as **strings** (never JS Numbers) to avoid precision loss.
- `tb_leaderboard_snapshots` has one column per source (`claude_tokens`, `codex_tokens`, `cursor_tokens`, `kiro_tokens`, `gemini_tokens`, `opencode_tokens`, `other_tokens`, `total_tokens`). Adding a new source = adding a column + updating the leaderboard service + adding it to `packages/contract/src/types.ts`.

### CLI parsers

`apps/cli/src/parsers/index.js` orchestrates 8 parsers, each exporting `{ source, detect, parse }`. Two archetypes:

- **File-tail parsers** (claude, codex, gemini, copilot) — track `(inode, byte_offset)` in `~/.tokenboard/cursors.json`. On rotate/truncate, reset to offset 0.
- **DB poll parsers** (opencode, kiro, cursor) — track a `lastRowId` or `updated_at` cursor. SQLite via the optional `better-sqlite3` peer dep.

**Adding a new parser**: write `apps/cli/src/parsers/<tool>.js` with `{source, detect, parse}`, register in `parsers/index.js`, add the source name to `packages/contract/src/types.ts`, add a `<tool>_tokens` column to `tb_leaderboard_snapshots`, write a parser test.

### Privacy invariant (read before touching parsers)

Only token *counts* and *timestamps* are uploaded. Never prompts, responses, file contents, or filenames. Enforced at three layers:

1. Parser code in `apps/cli/src/parsers/*.js` — only reads token-count fields
2. The shared `UsageBucket` type in `packages/contract/src/types.ts` has no field for content
3. API ingest validation rejects unknown fields

Code review must reject any parser that touches message bodies. This is non-negotiable.

### Timezone handling

The API stores buckets in UTC. The dashboard and menu bar widget pass `tz=IANA` (e.g., `tz=America/Los_Angeles`) on read endpoints so date boundaries align to the user's local wallclock. Without `tz`, the API defaults to UTC.

Dashboard reads `Intl.DateTimeFormat().resolvedOptions().timeZone` once at module load, passes it everywhere. Menu bar uses `TimeZone.current.identifier`.

### Local CLI state

```
~/.tokenboard/
├── config.json               backend URL + device token (mode 0600)
├── queue.jsonl               pending buckets (NDJSON, append-only)
├── queue.state.json          byte offset committed
├── cursors.json              per-source incremental parse state
└── secrets/                  AES-GCM fallback keychain (Linux without keytar)
```

Override with `TOKENBOARD_HOME=/path/to/dir`. Tests use this — see `apps/cli/test/claude-parser.test.js` for the pattern.

### macOS menu bar widget

Native Swift, no Xcode project. Compiled with `swiftc -O` directly because SwiftPM's manifest-loader stack is broken on most Command Line Tools installs.

If `swiftc` itself fails with "redefinition of module 'SwiftBridging'":
```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap{,.bak}
```

The Settings.swift uses a **0600 file** at `~/Library/Application Support/TokenBoard/token` for the user JWT instead of Keychain. Reason: every dev rebuild changes the unsigned binary identity, and macOS Keychain entries default to "this exact binary only" ACL → `errSecUserCanceled (-128)` on read after rebuild.

The bar app uses `launchctl bootstrap gui/$UID` (the modern API) — `launchctl load`/`unload` is deprecated and doesn't bind to the GUI session correctly on macOS 13+.

## Operational notes

- **All migrations are idempotent** — safe to re-run `pnpm migrate`. The runner tracks applied versions in `tb_schema_migrations`.
- **Leaderboard refresh** — node-cron inside the web app runs every 5 min. Disable with `LEADERBOARD_REFRESH_DISABLED=true` for multi-replica deploys.
- **Bootstrap admin** — first user with `AUTH_BYPASS_EMAIL` or from `ALLOWED_EMAIL_DOMAINS` is auto-created.
- **Email-domain allowlist** — `ALLOWED_EMAIL_DOMAINS=mumzworld.com` blocks signups from other domains. Empty = allow all (dev only).

## Conventions

- Package names: `@tokenboard/web`, `@tokenboard/contract`. CLI is `tokenboard-cli` (no scope, ships to npm). Bin name: `tokenboard`.
- Env-var prefix: `TOKENBOARD_*` for CLI, `NEXT_PUBLIC_*` for client-side, plain names (`DATABASE_URL`, `NEXTAUTH_SECRET`, etc.) for server.
- DB table prefix: `tb_`.
- Token columns in API responses: bigint-as-string. Never serialize as JS `number`.
- TS files use ESM (`"type": "module"` in web). CLI is CommonJS (`"type": "commonjs"`).
- Default to writing **no comments**. Add a comment only when a future reader would be surprised by the code.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
