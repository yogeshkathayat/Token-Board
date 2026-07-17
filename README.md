# TokenBoard

Company-local token-usage tracker for Mumzworld. Self-hosted SaaS for monitoring AI tool token consumption across your engineering team.

## Architecture

TokenBoard is a single-tenant system with four cooperating components:

- **apps/web** — Next.js 16 dashboard + leaderboard + ingest API + auth (TypeScript, pnpm)
- **apps/cli** — `tokenboard-cli` npm package for local token collection (Node 20, CommonJS)
- **apps/menubar** — Native Swift macOS menu bar widget (optional)
- **packages/contract** — Shared TypeScript types + half-hour bucket helpers

### Data flow

```
AI tools (Claude Code, Copilot, Cursor, etc.)
   │ write to ~/.claude/projects/*.jsonl, ~/.cursor/*, etc.
   ▼
CLI parsers (incremental, cursor-based)
   │ aggregate to ~/.tokenboard/queue.jsonl
   ▼
tokenboard sync → POST /api/v1/ingest (device-token auth)
   │ idempotent upsert keyed by (user, device, source, model, half-hour UTC bucket)
   ▼
tb_usage_buckets (Postgres, partitioned by month)
   │ pre-computed leaderboards (node-cron every 5 min)
   ▼
tb_leaderboard_snapshots (week / month / total)
```

### Privacy invariant

Only **token counts** and **timestamps** are uploaded — never prompts, responses, file contents, or filenames. Enforced at three layers:

1. Parser code only reads token-count fields
2. The shared `UsageBucket` type has no field for content
3. API ingest validation rejects unknown fields

### Auth model

- **User JWT** (dashboard / menu bar): HS256 over `NEXTAUTH_SECRET`, 1-hour TTL
- **Device token** (CLI): long-lived, sha256-hashed, issued via link-code exchange
- **Link codes**: 6-char A-Z/2-9, 10-min TTL, single-use (CLI ↔ browser handshake)
- **Development bypass**: `AUTH_BYPASS=true` skips external SSO (only for local dev)
- **Production**: Wire Auth Desk SSO, set `AUTH_BYPASS=false`, configure `ALLOWED_EMAIL_DOMAINS=mumzworld.com`

## Quickstart

### Prerequisites

- Node 20+ (see `.nvmrc`)
- Docker + Docker Compose (for containerized deployment)
- pnpm (for local development)

### Local development (no Docker)

1. **Start Postgres:**

   ```bash
   docker run -d --name tokenboard-pg \
     -e POSTGRES_USER=tokenboard \
     -e POSTGRES_PASSWORD=devpw \
     -e POSTGRES_DB=tokenboard \
     -p 5432:5432 \
     postgres:16-alpine
   ```

2. **Configure environment:**

   ```bash
   cd apps/web
   cp .env.example .env
   # Edit .env: set DATABASE_URL, AUTH_BYPASS=true, AUTH_BYPASS_EMAIL=dev@mumzworld.com
   ```

3. **Install dependencies and run migrations:**

   ```bash
   pnpm install
   pnpm migrate
   ```

4. **Start dev server:**

   ```bash
   pnpm dev
   # Dashboard available at http://localhost:3000
   ```

### Docker deployment (recommended)

1. **Configure environment:**

   ```bash
   cd infra
   cp .env.example .env
   # Edit .env: set production secrets (NEXTAUTH_SECRET, POSTGRES_PASSWORD, etc.)
   # IMPORTANT: For production, set AUTH_BYPASS=false and wire Auth Desk SSO
   ```

2. **Start services:**

   ```bash
   docker compose up --build -d
   ```

3. **Check logs:**

   ```bash
   docker compose logs -f web
   ```

4. **Dashboard available at http://localhost:3000**

### CLI setup

The CLI collects token usage from local AI tools and syncs to the backend.

1. **Install:**

   ```bash
   npm install -g ./apps/cli
   # Or: cd apps/cli && npm install -g .
   ```

2. **Link to backend:**

   First, visit the dashboard and generate a link code, then:

   ```bash
   tokenboard init --link-code <6-char-code> --base-url http://localhost:3000
   ```

3. **Sync token usage:**

   ```bash
   tokenboard sync
   # Parses local AI tool logs and uploads token counts to the backend
   ```

4. **Auto-sync (optional):**

   Set up a cron job or systemd timer to run `tokenboard sync` every few minutes.

### macOS menu bar widget (optional)

Native Swift app for quick token stats.

1. **Build and install:**

   ```bash
   cd apps/menubar
   ./build.sh install
   ```

2. **View logs:**

   ```bash
   tail -f ~/Library/Logs/TokenBoardBar.log
   ```

3. **Uninstall:**

   ```bash
   ./build.sh uninstall
   ```

## Database

- **Schema:** Postgres 16, all tables prefixed `tb_`
- **Migrations:** Applied automatically on startup via `tsx src/lib/db/migrate.ts`
- **Partitioning:** `tb_usage_buckets` partitioned by month (lazy-created per request)
- **Leaderboard refresh:** node-cron every 5 min (disable with `LEADERBOARD_REFRESH_DISABLED=true` for multi-replica deploys)

## Configuration

Key environment variables (see `apps/web/.env.example` or `infra/.env.example`):

- `DATABASE_URL` — Postgres connection string
- `ALLOWED_EMAIL_DOMAINS` — Comma-separated (e.g., `mumzworld.com`)
- `NEXTAUTH_SECRET` — HS256 JWT secret (generate: `openssl rand -base64 32`)
- `LEADERBOARD_REFRESH_SECRET` — Secret for manual leaderboard refresh endpoint
- `AUTH_BYPASS` — `true` for local dev (mock user), `false` for production (Auth Desk SSO)
- `AUTH_BYPASS_EMAIL` — Mock user email when `AUTH_BYPASS=true`

## Development

```bash
# Root monorepo commands
pnpm install              # Bootstrap all workspaces
pnpm test                 # Run all tests
pnpm typecheck            # Typecheck all workspaces

# Web app (apps/web)
cd apps/web
pnpm dev                  # Dev server on :3000
pnpm build                # Production build
pnpm start                # Start standalone server
pnpm migrate              # Apply DB migrations
pnpm typecheck            # TypeScript check

# CLI (apps/cli)
cd apps/cli
npm test                  # Run tests
npm link                  # Install globally for testing

# Menu bar (apps/menubar)
cd apps/menubar
./build.sh install        # Build + install
./build.sh uninstall      # Remove
```

## Adding a new AI tool parser

1. Write `apps/cli/src/parsers/<tool>.js` with `{source, detect, parse}`
2. Register in `apps/cli/src/parsers/index.js`
3. Add source name to `packages/contract/src/types.ts` (gates API validation)
4. Add `<tool>_tokens` column to `tb_leaderboard_snapshots` + leaderboard service
5. Write parser test asserting: (a) tokens captured, (b) no message content captured, (c) incremental parsing

## Production deployment checklist

- [ ] Set `AUTH_BYPASS=false`
- [ ] Wire Auth Desk SSO (set `NEXT_PUBLIC_AUTH_DESK_URL`, `AUTH_DESK_API_URL`, etc.)
- [ ] Set strong `NEXTAUTH_SECRET` and `LEADERBOARD_REFRESH_SECRET`
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure `ALLOWED_EMAIL_DOMAINS=mumzworld.com`
- [ ] Set `NODE_ENV=production`
- [ ] Configure persistent volume for Postgres data
- [ ] Set up backups for `tokenboard-pgdata` volume
- [ ] Configure monitoring (logs, metrics, alerts)
- [ ] Set up HTTPS / reverse proxy (nginx, Caddy, etc.)
- [ ] For multi-replica deploys: set `LEADERBOARD_REFRESH_DISABLED=true` on all but one replica

## License

Proprietary — Mumzworld internal use only.
