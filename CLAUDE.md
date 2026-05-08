# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm install                               # bootstrap workspaces
npm test                                  # all workspace tests
npm run typecheck                         # all workspace typechecks
npm run dev:api                           # API on :3000 with tsx watch
npm run dev:dashboard                     # Vite dev server on :5173
npm run migrate                           # apply DB migrations (apps/api)

# Single-workspace
npm --workspace @tokenboard/api test
npm --workspace tokenboard-cli test
npm --workspace @tokenboard/shared test
(cd apps/api && npx tsc -p tsconfig.json --noEmit)        # API typecheck
(cd apps/dashboard && npx tsc -p tsconfig.json --noEmit)  # Dashboard typecheck
(cd apps/dashboard && npx vite build)                     # Dashboard prod build

# Single test file
node --test apps/cli/test/claude-parser.test.js
node --test --import tsx apps/api/test/unit/jwt.test.ts

# Local stack (Docker)
npm run compose:up                        # docker compose -f infra/docker-compose.yml up -d
npm run compose:logs
make -C infra setup up migrate            # full bootstrap

# Local stack (no Docker — for development)
docker run -d --name tokenboard-pg -e POSTGRES_USER=tokenboard \
  -e POSTGRES_PASSWORD=devpw -e POSTGRES_DB=tokenboard -p 54320:5432 postgres:16-alpine
DATABASE_URL='postgres://tokenboard:devpw@localhost:54320/tokenboard' \
  JWT_SECRET='local-dev-secret-32-bytes-aaaaaaaaaaaa' \
  npm --workspace @tokenboard/api run migrate
# then npm run dev:api + npm run dev:dashboard

# macOS menu bar (compiled directly with swiftc — SPM is broken on most CLT installs)
cd apps/menubar && ./build.sh install     # build + register launchd agent
./build.sh uninstall                      # remove
tail -f ~/Library/Logs/TokenBoardBar.log  # bar app logs
```

## Architecture

Token Board is a single-tenant self-hosted SaaS. Each deployment is one company; cross-tenant features are intentionally absent. Four cooperating components live in this monorepo:

```
apps/api          Fastify + Postgres backend (TypeScript, ESM)
apps/dashboard    React + Vite + Tailwind SPA (TypeScript)
apps/cli          tokenboard-cli npm package (Node 20, CommonJS)
apps/menubar      Native Swift macOS menu bar app
packages/shared   TypeScript types + half-hour bucket helpers
infra             docker-compose.yml + nginx + Makefile
```

### Data flow (read this first)

```
AI tools (Claude Code, Codex, etc.)
   │ writes to ~/.claude/projects/*.jsonl etc.
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

The half-hour bucketing happens **client-side** in `apps/cli/src/lib/buckets.js::halfHourFloor` and is re-validated by the API in `packages/shared/src/buckets.ts::isHalfHourBoundary`. Both must agree. `packages/shared` is the contract — types + boundary helpers only — and is built first (`npm --workspace @tokenboard/shared run build`) before the API or dashboard typecheck.

### Auth model (two distinct token types)

- **User JWT** (`Authorization: Bearer eyJ...`) — issued by `/auth/login`, `/auth/oidc/callback`, `/auth/refresh`. HS256 over `JWT_SECRET`. 1-hour TTL. Used by the dashboard and the macOS menu bar widget.
- **Device token** (`Authorization: Bearer <opaque>`) — issued by `/auth/device-token` or `/auth/link-code-exchange`. Long-lived, sha256-hashed server-side. Used only by the CLI for `/ingest` and `/sync-ping`.

The auth plugin at `apps/api/src/auth/plugin.ts` distinguishes the two by token shape (3 dot-separated segments → JWT). Routes opt in via `preHandler: app.requireUser | app.requireAdmin | app.requireDevice | app.optionalUser`.

The CLI ↔ browser handshake uses **link codes** (6-char A-Z/2-9, 10-min TTL, single-use). Dashboard mints one via `POST /auth/link-code-init`; CLI exchanges via `POST /auth/link-code-exchange` (public endpoint, idempotent on `request_id`).

### Database schema highlights

All tables prefixed with `tb_` (token board). Schema in `apps/api/migrations/0001_init.sql`. Key invariants:

- `tb_usage_buckets` is **partitioned by month** on `hour_start`. Migration `0002_partitions.sql` defines `tb_ensure_usage_partition(month_start date)` which the API calls per-request before inserts to lazy-create partitions. Don't insert without ensuring the partition exists.
- BIGINT token columns are returned to the client as **strings** (never JS Numbers) to avoid precision loss. Parse with `BigInt(...)`. The API's serialization is enforced via Kysely's `node-pg` BIGINT type parser override in `apps/api/src/db/index.ts`.
- `tb_leaderboard_snapshots` has one column per source (`claude_tokens`, `codex_tokens`, `gemini_tokens`, `opencode_tokens`, `kiro_tokens`, `cursor_tokens`, `copilot_tokens`, `openrouter_tokens`, `other_tokens`, `total_tokens`). Adding a new source = adding a column + updating `KNOWN_SOURCES` in `apps/api/src/services/leaderboard.ts` + adding it to `SOURCES` in `packages/shared/src/types.ts`.

### CLI parsers

`apps/cli/src/parsers/index.js` orchestrates 8 parsers, each exporting `{ source, detect, parse }`. `runAll()` calls `detect()` first to skip tools not installed; only then calls `parse()`.

Two parser archetypes:

- **File-tail parsers** (claude, codex, gemini, copilot) — track `(inode, byte_offset)` in `~/.tokenboard/cursors.json`. On rotate/truncate, reset to offset 0.
- **DB poll parsers** (opencode, kiro, cursor) — track a `lastRowId` or `updated_at` cursor. SQLite via the optional `better-sqlite3` peer dep — if not installed, parser silently skips.

The OpenRouter parser (`openrouter.js`) is a special case: it's the only one without a local file or DB. User pastes their OpenRouter API key via `tokenboard openrouter login` (stored via `keytar` with AES-GCM file fallback under `~/.tokenboard/secrets/`); parser pages backward through `GET /api/v1/generation` until it sees the cursor or hits 5 pages.

**Adding a new parser**: write `apps/cli/src/parsers/<tool>.js` with `{source, detect, parse}`, register in `parsers/index.js`, add the source name to `SOURCES` in `packages/shared/src/types.ts` (gates API ingest validation), add a `<tool>_tokens` column to `tb_leaderboard_snapshots` + the leaderboard service, write a parser test that asserts (a) tokens are captured, (b) no message content is captured, (c) parser is incremental.

### Privacy invariant (read SECURITY.md before touching parsers)

Only token *counts* and *timestamps* are uploaded. Never prompts, responses, file contents, or filenames. Enforced at three layers:

1. Parser code in `apps/cli/src/parsers/*.js` — only reads token-count fields
2. The shared `UsageBucket` type in `packages/shared/src/types.ts` has no field for content
3. API ingest validation rejects unknown fields via Fastify's AJV `removeAdditional: 'all'`

Code review must reject any parser that touches message bodies. This is non-negotiable.

### Timezone handling (subtle, easy to get wrong)

The API stores buckets in UTC. The dashboard, CLI, and macOS menu bar widget all need to **pass `tz=IANA`** (e.g., `tz=America/Los_Angeles`) on read endpoints so date boundaries align to the user's local wallclock. Without `tz`, the API defaults to UTC — which silently shifts "today" for non-UTC users.

- Dashboard reads `Intl.DateTimeFormat().resolvedOptions().timeZone` once at module load, passes it everywhere.
- Menu bar uses `TimeZone.current.identifier` and `Calendar.date(byAdding: .day, ...)` (handles DSTs).
- The API caps date ranges at `USAGE_MAX_DAYS` (default 800). When querying "all time" from clients, use `daysAgo(798)` not `1970-01-01`.

### Local CLI state

```
~/.tokenboard/
├── config.json               backend URL + device token (mode 0600)
├── queue.jsonl               pending buckets (NDJSON, append-only)
├── queue.state.json          byte offset committed
├── cursors.json              per-source incremental parse state
├── upload.throttle.json      backoff state machine
├── openrouter.cursor.json    last seen OpenRouter generation_id
├── secrets/                  AES-GCM fallback keychain (Linux without keytar)
├── bin/notify.cjs            hook trampoline (spawned by AI tools on session end)
└── tokenboard.log            (reserved)
```

Override with `TOKENBOARD_HOME=/path/to/dir`. Tests use this — see `apps/cli/test/claude-parser.test.js` for the pattern (set `TEST_HOME` + `TEST_TRACKER_HOME` *at module load*, before requiring the parser, because `os.homedir()` reads `process.env.HOME` lazily but caching can bite you).

### macOS menu bar widget

Native Swift, no Xcode project. Compiled with `swiftc -O` directly because SwiftPM's manifest-loader stack is broken on most Command Line Tools installs (PackageDescription ABI mismatch + duplicate `SwiftBridging` modulemap from interrupted updates).

If `swiftc` itself fails with "redefinition of module 'SwiftBridging'":
```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap{,.bak}
```

The Settings.swift uses a **0600 file** at `~/Library/Application Support/TokenBoard/token` for the user JWT instead of Keychain. Reason: every dev rebuild changes the unsigned binary identity, and macOS Keychain entries default to "this exact binary only" ACL → `errSecUserCanceled (-128)` on read after rebuild. Don't switch back to Keychain without first solving the unsigned-binary ACL problem (probably means proper Developer ID + notarization, which is out of scope for a local helper).

The bar app reads `~/.tokenboard/config.json` to auto-fill the server URL. It uses `launchctl bootstrap gui/$UID` (the modern API) — `launchctl load`/`unload` is deprecated and doesn't bind to the GUI session correctly on macOS 13+, which makes `NSStatusItem` invisible.

## Operational notes

- **All migrations are idempotent** — safe to re-run `npm run migrate`. The runner (`apps/api/src/db/migrate.ts`) tracks applied versions in `tb_schema_migrations`.
- **Leaderboard refresh** — node-cron inside the API container runs every 5 min. Disable with `LEADERBOARD_REFRESH_DISABLED=true` for multi-replica deploys; pick one replica to run it.
- **Bootstrap admin** — set `BOOTSTRAP_ADMIN_EMAIL=alice@acme.com` in env. The first user with that email is auto-promoted to `role=admin`. After promotion, the env var has no further effect.
- **Email-domain allowlist** — `ALLOWED_EMAIL_DOMAINS=acme.com,acme.io` blocks signups from other domains. Empty = allow all.

## Conventions

- Package names: `@tokenboard/api`, `@tokenboard/dashboard`, `@tokenboard/shared`. CLI is `tokenboard-cli` (no scope, since it ships to npm). Bin name: `tokenboard`.
- Env-var prefix: `TOKENBOARD_*` for CLI, `VITE_*` for dashboard build-time, plain names (`DATABASE_URL`, `JWT_SECRET`, etc.) for the API.
- DB table prefix: `tb_`. Don't use `ut_` (legacy from before rename).
- Token columns in API responses: bigint-as-string. Never serialize as JS `number`.
- TS files use ESM (`"type": "module"` in api + dashboard). CLI is CommonJS (`"type": "commonjs"`).
- Default to writing **no comments**. Add a comment only when a future reader would be surprised by the code — e.g. workarounds for upstream bugs (see `Settings.swift`'s Keychain comment, the launchctl bootstrap note in `build.sh`). Don't comment what the code does — name things well instead.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`.
