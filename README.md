<p align="center">
  <img src="apps/web/public/logomark.svg" width="80" alt="TokenBoard logo" />
</p>

<h1 align="center">TokenBoard</h1>

<p align="center">
  Self-hostable AI token-usage tracker and company leaderboard for engineering teams.
</p>

---

## What is TokenBoard?

TokenBoard is a **single-tenant, self-hostable** tool that tracks your team's AI coding-assistant token usage and ranks developers on a company leaderboard. Each deployment serves one organization — no cross-tenant features, no shared cloud infrastructure, just a Docker container you run on your own hardware.

Developers install a CLI that monitors local AI tools (Claude Code, Codex, Cursor, Gemini, Kiro, and OpenCode), collects token counts, and uploads them to your backend. The dashboard shows:

- **KPI cards** — today/week/month/all-time usage
- **30-day usage chart** — trend visualization with per-tool breakdown
- **Company leaderboard** — ranked by total token consumption
- **GitHub-style activity heatmap** — daily usage grid
- **Per-tool breakdown** — with dedicated icons for each AI tool
- **Top models** — which LLMs your team uses most

An optional macOS menu-bar widget provides at-a-glance stats without opening the browser.

### Privacy Guarantee

**Only token counts and timestamps are collected — never prompts, responses, file contents, or filenames.** This is enforced at three layers:

1. Parser code only reads token-count fields from local logs
2. The shared `UsageBucket` type has no field for message content
3. API ingest validation rejects unknown fields

All parsers are tested to verify they do **not** capture sensitive content.

---

## Architecture

TokenBoard is a monorepo with four cooperating components:

```
apps/web          Next.js 16 (App Router) — dashboard + leaderboard UI + ingest API
apps/cli          tokenboard-cli — local collector (Node 20, CommonJS)
apps/menubar      macOS menu-bar widget (native Swift, built with swiftc)
packages/contract CLI↔web ingest contract + parity test
infra             Multi-stage Dockerfile + docker-compose (web + postgres)
```

### Data Flow

```
AI tools (Claude Code, Codex, Cursor, Gemini, Kiro, OpenCode)
   │ write to ~/.claude/projects/*.jsonl, ~/.cursor/*, etc.
   ▼
CLI parsers (incremental, cursor-based)
   │ aggregate to ~/.tokenboard/queue.jsonl
   ▼
tokenboard sync → POST /api/ingest (device-token auth)
   │ idempotent upsert keyed by (user, device, source, model, half-hour UTC bucket)
   ▼
tb_usage_buckets (Postgres)
   │ pre-computed leaderboards (node-cron every 5 min)
   ▼
tb_leaderboard_snapshots (week / month / total) → dashboard + leaderboard
```

### Supported AI Tools

**Full incremental parsers** (file-tail with inode+offset tracking):
- Claude Code
- Codex
- Gemini

**Best-effort parsers** (SQLite DB polling, graceful skip if not installed):
- Kiro
- OpenCode

**Wired but inert** (needs remote-API auth not collected yet):
- Cursor

### Authentication

Two distinct auth modes:

- **User JWT** (dashboard / menu bar): NextAuth with external SSO integration point (currently deferred — dev uses `AUTH_BYPASS`)
- **Device token** (CLI): Long-lived, sha256-hashed tokens issued via link-code exchange

**Link codes**: 6-character A-Z/2-9 codes with 10-minute TTL and single-use enforcement. Minted in the dashboard, exchanged by the CLI for a device token during `tokenboard init`.

---

## Quickstart

### Prerequisites

- **Docker + Docker Compose** (for containerized deployment)
- **Node 20+** (for CLI and local development)
- **pnpm** (for local web development)

### 1. Deploy the Backend (Docker)

```bash
cd infra
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, NEXTAUTH_SECRET, etc.
# For development: leave AUTH_BYPASS=true (no SSO required)
docker compose up --build -d
```

Dashboard available at **http://localhost:3000**

### 2. Install the CLI

Developers on your team install the CLI to collect token usage:

```bash
npm install -g ./apps/cli
# Or: cd apps/cli && npm install -g .
```

### 3. Pair the CLI with the Backend

1. Visit the dashboard and generate a **link code** (6 characters)
2. Pair your device:

```bash
tokenboard init --link-code <CODE> --base-url http://localhost:3000
```

### 4. Sync Token Usage

Manually sync token usage:

```bash
tokenboard sync
```

Or set up auto-sync (runs every 5 minutes):

```bash
tokenboard autosync install
```

The CLI reads local AI tool logs, extracts token counts, and uploads them to your backend. It works offline — queued data persists and uploads when network is restored.

### 5. macOS Menu Bar Widget (Optional)

Native Swift app for quick stats:

```bash
cd apps/menubar
./build.sh install
```

The menu bar widget is **local-first** — it reads `~/.tokenboard/summary.json` (written by the CLI on each sync) directly. No server auth, works offline.

---

## Configuration

Key environment variables for `apps/web` (see `infra/.env.example` or `apps/web/.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | Postgres connection string |
| `NEXTAUTH_SECRET` | Yes | - | HS256 JWT secret (generate: `openssl rand -base64 32`) |
| `ALLOWED_EMAIL_DOMAINS` | No | (all) | Comma-separated email domains (e.g., `acme.com,acme.io`) to restrict leaderboard access |
| `AUTH_BYPASS` | No | `false` | Set `true` for local dev (mock user, no SSO) |
| `AUTH_BYPASS_EMAIL` | No | - | Mock user email when `AUTH_BYPASS=true` |
| `AUTH_BYPASS_ALLOW_IN_PROD` | No | `false` | Explicit insecure-demo acknowledgment to allow `AUTH_BYPASS` in production builds |
| `LEADERBOARD_REFRESH_SECRET` | No | - | Secret for manual leaderboard refresh endpoint (`POST /api/leaderboard/refresh`) |
| `LEADERBOARD_REFRESH_DISABLED` | No | `false` | Disable automatic 5-min cron refresh (for multi-replica deploys, enable on all but one replica) |

---

## Local Development (Without Docker)

For active web development, run Postgres in Docker but the Next.js app directly:

### 1. Start Postgres

```bash
docker run -d --name tokenboard-pg \
  -e POSTGRES_USER=tokenboard \
  -e POSTGRES_PASSWORD=devpw \
  -e POSTGRES_DB=tokenboard \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Configure Environment

```bash
cd apps/web
cp .env.example .env
# Edit .env:
#   DATABASE_URL='postgres://tokenboard:devpw@localhost:5432/tokenboard'
#   AUTH_BYPASS=true
#   AUTH_BYPASS_EMAIL=dev@yourcompany.com
#   NEXTAUTH_SECRET='local-dev-secret-32-bytes-min'
```

### 3. Install Dependencies & Run Migrations

```bash
pnpm install
pnpm migrate
```

### 4. Start Dev Server

```bash
pnpm dev
# Dashboard available at http://localhost:3000
```

### 5. Typecheck & Test

```bash
pnpm typecheck   # TypeScript check
pnpm test        # Run tests
```

---

## Project Layout

```
tokenboard/
├── apps/
│   ├── web/                      Next.js 16 backend + dashboard
│   │   ├── src/
│   │   │   ├── app/              App Router (routes + pages)
│   │   │   ├── components/       React components (shadcn/ui)
│   │   │   ├── lib/              DB, auth, utils
│   │   │   └── styles/           Tailwind v4
│   │   ├── migrations/           Postgres schema (idempotent)
│   │   ├── scripts/              migrate.mjs
│   │   └── test/                 Unit tests
│   ├── cli/                      tokenboard-cli collector
│   │   ├── src/
│   │   │   ├── parsers/          AI tool parsers (claude, cursor, etc.)
│   │   │   ├── lib/              buckets, queue, uploader
│   │   │   └── commands/         init, sync, config, status
│   │   └── test/                 Parser tests
│   └── menubar/                  macOS menu bar widget
│       ├── Sources/              Swift sources
│       └── build.sh              swiftc build + launchd install
├── packages/
│   └── contract/                 CLI↔web ingest contract
│       ├── src/types.ts          UsageBucket, SOURCES
│       ├── src/buckets.ts        Half-hour boundary helpers
│       └── test/parity.test.ts   Contract parity test
├── infra/
│   ├── Dockerfile                Multi-stage (pnpm + standalone)
│   ├── docker-compose.yml        web + postgres
│   └── .env.example              Production config template
└── docs/                         Additional documentation
```

---

## Database

- **Schema**: Postgres 16, all tables prefixed `tb_`
- **Migrations**: Applied via `pnpm migrate` (idempotent, version-tracked in `tb_schema_migrations`)
- **Storage**: `tb_usage_buckets` is a single indexed table (not partitioned in v1)
- **Leaderboard refresh**: node-cron every 5 min (disable with `LEADERBOARD_REFRESH_DISABLED=true` for multi-replica deploys)
- **BIGINT serialization**: Token counts are returned as **strings** (never JS numbers) to avoid precision loss

---

## Deploying to Production

### Pre-Deployment Checklist

- [ ] Set `AUTH_BYPASS=false`
- [ ] Wire external SSO (Auth Desk or your provider) — integration point is deferred in current version
- [ ] Set strong `NEXTAUTH_SECRET` and `LEADERBOARD_REFRESH_SECRET` (at least 32 bytes)
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure `ALLOWED_EMAIL_DOMAINS` to restrict leaderboard access to your organization's email domains
- [ ] Set `NODE_ENV=production`
- [ ] Configure persistent volume for Postgres data (see `docker-compose.yml`)
- [ ] Set up automated backups for `tokenboard-pgdata` volume
- [ ] Configure monitoring (logs, metrics, alerts)
- [ ] Set up HTTPS / reverse proxy (nginx, Caddy, Traefik, etc.)
- [ ] For multi-replica deploys: set `LEADERBOARD_REFRESH_DISABLED=true` on all but one replica

### Docker Deployment

```bash
cd infra
cp .env.example .env
# Edit .env with production secrets (see checklist above)
docker compose up --build -d
```

### Environment Variables for Production

```bash
DATABASE_URL='postgres://tokenboard:<strong-password>@postgres:5432/tokenboard'
NEXTAUTH_SECRET='<64-char-hex-from-openssl-rand-hex-32>'
LEADERBOARD_REFRESH_SECRET='<another-64-char-hex>'
ALLOWED_EMAIL_DOMAINS='yourcompany.com,yourcompany.io'
AUTH_BYPASS=false
NODE_ENV=production
```

---

## Adding a New AI Tool Parser

To add support for a new AI coding assistant:

1. **Write the parser**: Create `apps/cli/src/parsers/<tool>.js` with `{source, detect, parse}`
2. **Register it**: Add to `apps/cli/src/parsers/index.js`
3. **Update contract**: Add source name to `apps/web/src/lib/contract.ts` (gates API validation)
4. **Update leaderboard schema**: Add `<tool>_tokens` column to `tb_leaderboard_snapshots` + update leaderboard service
5. **Write tests**: Assert (a) tokens captured, (b) no message content captured, (c) incremental parsing

See existing parsers in `apps/cli/src/parsers/` for reference.

---

## CLI Commands

```bash
tokenboard init --link-code <CODE> --base-url <URL>   # Pair CLI with backend
tokenboard device-login                               # Re-pair an existing device
tokenboard sync [--drain] [--force]                   # Upload token usage
tokenboard autosync install|uninstall|status          # Configure auto-sync (launchd/systemd)
tokenboard status                                     # Show local state
tokenboard config                                     # Show configuration
```

---

## Development Commands

### Web (apps/web)

```bash
cd apps/web
pnpm dev          # Dev server on :3000
pnpm build        # Production build (standalone output)
pnpm start        # Start standalone server
pnpm migrate      # Apply DB migrations
pnpm typecheck    # TypeScript check
pnpm test         # Run tests
```

### CLI (apps/cli)

```bash
cd apps/cli
npm test          # Run parser tests
npm link          # Install globally for testing
node --test test/claude-parser.test.js  # Single test file
```

### Menu Bar (apps/menubar)

```bash
cd apps/menubar
./build.sh install      # Build + install launchd agent
./build.sh uninstall    # Remove
tail -f ~/Library/Logs/TokenBoardBar.log  # View logs
```

### Docker

```bash
cd infra
docker compose up --build -d      # Start services
docker compose logs -f web        # View logs
docker compose down               # Stop services
```

---

## Branding

The TokenBoard logo represents **ascending token bars** — a visual metaphor combining tokens (pill-shaped capsules) with leaderboard ranking (ascending heights for 3rd, 2nd, 1st place).

- **Primary color**: Cyan 500 (`#06b6d4`)
- **Supporting tones**: Cyan 600 (`#0891b2`), Cyan 700 (`#0e7490`)

See `apps/web/public/brand.md` for complete brand guidelines.

---

## License

MIT
