<div align="center">

<img src="docs/screenshots/logo.png" width="80" height="80" alt="Token Board logo" />

# Token Board

**Self-hostable AI token usage tracker — see what your team is spending across Claude, Codex, Gemini, OpenCode, Kiro, Cursor, Copilot, and OpenRouter.**

[Features](#features) · [Quickstart](#quickstart) · [Architecture](#architecture) · [CLI](#cli) · [Menu bar widget](#menu-bar-widget) · [Deploy](#deploy) · [Contributing](#contributing)

</div>

---

## What it is

Token Board is a small **self-hosted** SaaS for tracking AI coding-tool token usage across an engineering team.

Each engineer installs a tiny Node.js CLI on their laptop. The CLI parses local AI tool history files (Claude Code's JSONL, Kiro's SQLite, etc.) and uploads aggregated half-hour buckets to your own server. Everyone sees their usage on a private dashboard with a leaderboard, daily trend, model breakdown, and an opt-in privacy toggle.

A native macOS menu bar widget shows today's count at a glance, with a popover for stat cards and top models — like having `htop` for tokens pinned to your menu bar.

**Privacy by design**: only token _counts_ and _timestamps_ are uploaded — never prompts, responses, or file contents.

## Screenshots

### Dashboard

The signed-in dashboard with stat cards (Today / 7-Day / 30-Day / Total), per-tool limits, GitHub-style activity heatmap, trend chart with period selector, and top-models list.

![Dashboard](docs/screenshots/dashboard.png)

> _Placeholder — real screenshot coming soon._

### Leaderboard

Per-source breakdown across all 8 supported tools, with rank medals for top 3 and gradient avatars for each engineer. Privacy toggle in Settings makes you anonymous.

![Leaderboard](docs/screenshots/leaderboard.png)

> _Placeholder — real screenshot coming soon._

### Menu bar widget (macOS)

Native Swift app — `📊 157.3M` in the menu bar (today's count, resets at local midnight). Click for a popover with the same stat cards as the dashboard.

![Menu bar](docs/screenshots/menubar-full.png)

> _Placeholder — real screenshot coming soon._

## Features

- 📊 **Personal dashboard** — totals, daily trend (smooth area chart with Day/Week/Month/Total selector), GitHub-style activity heatmap, top models with % share
- 🏆 **Org leaderboard** — week / month / all-time rankings, per-source columns, opt-in public profile
- 📉 **Per-tool limits** — utilization bars for 5h and 7d windows, plan markers (Claude Max, ChatGPT Pro, etc.)
- 🍎 **macOS menu bar widget** — native SwiftUI, today's count always visible, popover with full breakdown
- 🌗 **Light / Dark / System** theme — proper dropdown, persisted, no flash on first paint
- 🔒 **Generic OIDC SSO** — works with Google Workspace, Okta, Azure AD, Auth0, Keycloak, etc., or email + password
- 🐳 **Docker Compose** — one-command deploy on a VM
- 🔐 **Privacy invariant** — token counts only, never message content. Device tokens stored as sha256 hashes server-side. Optional nginx Bearer→hash proxy guard.

## Supported AI tools

| Tool               | Mechanism                                                                  | Status                                                                                   |
| ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Claude Code**    | `~/.claude/projects/*.jsonl` parser                                        | ✅ exact token counts                                                                    |
| **Kiro**           | `~/Library/Application Support/kiro-cli/data.sqlite3` (`conversations_v2`) | ⚠️ estimated from prompt/response char length (Kiro doesn't expose token counts locally) |
| **Codex CLI**      | `~/.codex/sessions/**/rollout-*.jsonl` parser                              | ✅ exact (when used)                                                                     |
| **Gemini CLI**     | `~/.gemini/tmp/**/session-*.json` parser                                   | ✅ exact (when used)                                                                     |
| **OpenCode**       | `~/.config/opencode/opencode.db` SQLite                                    | ✅ exact (when used)                                                                     |
| **Cursor**         | `state.vscdb` auth + Cursor's usage API                                    | ⚠️ requires paid plan + keychain workaround                                              |
| **GitHub Copilot** | `$COPILOT_OTEL_FILE_EXPORTER_PATH` JSONL                                   | ✅ when env var is set                                                                   |
| **OpenRouter**     | API key + paginated `/api/v1/generation` poll                              | ✅ exact, runs every sync                                                                |

## Architecture

```
                    ┌────────────────────────────┐
Developer laptop    │  Browser dashboard         │
┌────────────────┐  │  (React + Vite + Tailwind) │
│ Claude/Codex/  │  │  ── OIDC login ──▶         │
│ Cursor/Kiro/.. │  │                            │
└──────┬─────────┘  └──────────┬─────────────────┘
       │ hook fires            │ HTTPS
       ▼                       │
┌────────────────┐             │
│ tokenboard     │             │
│ CLI (Node 20)  │             │
│ — parses logs  │             │
│ — queue.jsonl  │             │
│ — uploads      │             │
└──────┬─────────┘             │
       │ HTTPS Bearer          │
       ▼                       ▼
       ╔═══════════════════════════════════════╗
       ║  Reverse proxy (nginx, port 443)      ║
       ║   — TLS termination                   ║
       ║   — /api/*  → API service             ║
       ║   — /  → static dashboard             ║
       ║   — Bearer→sha256 hash on /ingest     ║
       ╚════════┬══════════════════┬═══════════╝
                │                  │
        ┌───────▼────────┐  ┌──────▼──────┐
        │  API service   │  │  Static     │
        │  Node 20 +     │  │  dashboard  │
        │  Fastify       │  │  (React SPA)│
        │  + JWT/OIDC    │  └─────────────┘
        └───────┬────────┘
                │
        ┌───────▼────────┐         ┌────────────────────────┐
        │   PostgreSQL   │         │ macOS menu bar widget  │
        │  (partitioned  │         │ (SwiftUI native app,   │
        │  by month)     │         │  reads /api/v1/usage/*)│
        └────────────────┘         └────────────────────────┘
```

### Repo layout

```
tokenboard/
├── apps/
│   ├── api/         Fastify + Kysely + Postgres backend (TypeScript)
│   ├── dashboard/   React + Vite + Tailwind SPA (TypeScript)
│   ├── cli/         tokenboard-cli npm package (Node 20, CommonJS)
│   └── menubar/     Swift macOS menu bar app
├── packages/
│   └── shared/      Types shared between api and dashboard
├── infra/
│   ├── docker-compose.yml + nginx config + Makefile
│   └── .env.example
├── docs/
│   ├── DEPLOY.md, CONFIG.md, API.md, CLI.md, SECURITY.md
│   └── screenshots/
└── package.json     npm workspaces root
```

## Quickstart

### Server side (admin, once)

```bash
git clone git@github.com:yogeshkathayat/Token-Board.git
cd Token-Board/infra
cp .env.example .env
# Edit .env: PUBLIC_URL, DB_PASSWORD, JWT_SECRET (use `openssl rand -base64 48`),
# OIDC_* if you want SSO, BOOTSTRAP_ADMIN_EMAIL.
make setup
make up
make migrate
```

The stack now runs at `https://your-public-url`. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full guide including TLS, OIDC, backups.

### Engineer side (per-laptop, one curl)

Open the dashboard, click **Settings → Devices → Generate code**, then paste the one-liner shown there into a terminal:

```bash
curl -fsSL https://your-public-url/install.sh?code=ABC234 | sh
```

The script installs the CLI globally (`npm install -g tokenboard-cli`), links the device using the baked-in code, installs hooks for every detected AI tool, and offers to start the background sync daemon. After this, every AI session you have automatically lands on the dashboard within ~30 seconds.

### Local development

If you'd rather poke at the stack locally before deploying:

```bash
git clone git@github.com:yogeshkathayat/Token-Board.git
cd Token-Board
npm install

# Start postgres in Docker
docker run -d --name tokenboard-pg \
  -e POSTGRES_USER=tokenboard -e POSTGRES_PASSWORD=devpw -e POSTGRES_DB=tokenboard \
  -p 54320:5432 postgres:16-alpine

# Run migrations
DATABASE_URL='postgres://tokenboard:devpw@localhost:54320/tokenboard' \
  JWT_SECRET='local-dev-secret-32-bytes-aaaaaaaaaaaa' \
  npm --workspace @tokenboard/api run migrate

# Start API (terminal 1)
DATABASE_URL='postgres://tokenboard:devpw@localhost:54320/tokenboard' \
  JWT_SECRET='local-dev-secret-32-bytes-aaaaaaaaaaaa' \
  PUBLIC_URL='http://localhost:5173' PORT=3001 \
  npm --workspace @tokenboard/api run dev

# Start dashboard (terminal 2)
VITE_API_TARGET='http://localhost:3001' \
  npm --workspace @tokenboard/dashboard run dev

# Visit http://localhost:5173 — sign up with any email + password
```

## CLI

```bash
npm install -g tokenboard-cli   # or use the install.sh from the dashboard

tokenboard init <BASE_URL>       # link this device, install hooks
tokenboard link <CODE>           # short-form link (uses code from dashboard)
tokenboard sync                  # parse all sources + upload (run by hooks/daemon)
tokenboard status                # queue size, last sync, detected tools
tokenboard doctor                # health check
tokenboard daemon install        # background timer that syncs every 10 min
tokenboard openrouter login      # paste your OpenRouter API key
tokenboard uninstall             # remove all hooks + local state
```

State lives under `~/.tokenboard/` with 0600/0700 file modes. Override with `TOKENBOARD_HOME=/somewhere/else`. See [`docs/CLI.md`](docs/CLI.md) for the full reference.

## Menu bar widget

```bash
cd apps/menubar
./build.sh install
```

Compiles the Swift binary (no Xcode project required, just `swiftc`), installs it to `~/Library/Application Support/TokenBoard/`, and registers a launchd agent at `~/Library/LaunchAgents/com.tokenboard.bar.plist` so it auto-starts on login.

The bar shows today's token count (resets at local midnight). Click for a popover with stat cards, sources, and top models. See [`apps/menubar/README.md`](apps/menubar/README.md) for token-paste flow + troubleshooting.

If `swift build` fails with "this SDK is not supported by the compiler" or "redefinition of module 'SwiftBridging'", your Command Line Tools are out of sync. The README has a one-line fix.

## API

The backend exposes a small REST surface under `/api/v1/`. Highlights:

| Endpoint                        | Auth          | Purpose                                        |
| ------------------------------- | ------------- | ---------------------------------------------- |
| `POST /auth/login`              | public        | email + password → access JWT + refresh cookie |
| `GET /auth/oidc/start`          | public        | OIDC redirect (Google / Okta / etc.)           |
| `POST /auth/link-code-init`     | user JWT      | generate a 6-char code for CLI handshake       |
| `POST /auth/link-code-exchange` | public        | CLI swaps code → device token                  |
| `POST /ingest`                  | device token  | upload half-hour buckets (idempotent upsert)   |
| `GET /usage/summary`            | user JWT      | totals over a date range                       |
| `GET /usage/daily`              | user JWT      | daily breakdown                                |
| `GET /usage/heatmap`            | user JWT      | 52-week activity grid                          |
| `GET /usage/model-breakdown`    | user JWT      | per-source × per-model                         |
| `GET /leaderboard`              | optional auth | ranked users with per-source columns           |
| `GET/POST /public-visibility`   | user JWT      | privacy opt-in toggle                          |
| `GET /healthz`                  | public        | health check                                   |

Full reference: [`docs/API.md`](docs/API.md).

## Deploy

Production: [`docs/DEPLOY.md`](docs/DEPLOY.md). Single-VM Docker Compose stack with:

- **db**: postgres:16-alpine (volume-backed)
- **api**: Fastify on Node 20
- **dashboard**: nginx serving the built React SPA
- **proxy**: nginx with TLS + njs Bearer→sha256 hashing on `/ingest` (defense in depth)

A `Makefile` wraps the common commands (`make up`, `make logs`, `make migrate`, `make backup`, `make restore`).

## Tech stack

- **Backend**: Node 20, [Fastify 5](https://fastify.dev/), [Kysely](https://kysely.dev/) (type-safe SQL), [argon2](https://github.com/ranisalt/node-argon2), [openid-client](https://github.com/panva/node-openid-client)
- **Frontend**: React 18, [Vite 5](https://vitejs.dev/), [Tailwind CSS 3](https://tailwindcss.com/), [React Router 7](https://reactrouter.com/)
- **CLI**: Node 20 CommonJS, [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (optional)
- **Menu bar**: Swift 5.9+, SwiftUI, AppKit
- **Database**: PostgreSQL 16 with month-partitioned `tb_usage_buckets`
- **Tests**: 33 across CLI / API / shared package — `node --test` + `vitest`

## Privacy & security

- Only token counts and timestamps are uploaded. Never prompts, responses, file contents, or filenames. Enforced at the parser layer in `apps/cli/src/parsers/*.js` and at the API ingest validator.
- Device tokens are sha256-hashed before being stored. Optional nginx njs handler hashes the bearer at the proxy edge so device tokens never appear in API logs.
- Refresh tokens, passwords, and device tokens all hashed with argon2id / sha256 at rest.
- OIDC with state + PKCE + nonce validation.
- Rate limiting: 60/hour/IP on `/auth/*`, 300/min/device on `/ingest`.
- Optional email-domain allowlist (`ALLOWED_EMAIL_DOMAINS=acme.com,acme.io`).

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full threat model.

## Contributing

```bash
nvm use                    # picks up .nvmrc → Node 20
npm install
npm test                   # runs all workspace tests
```

Conventions:

- Prettier + 2-space indent, semicolons + single quotes (TS), CommonJS in CLI
- Strict TypeScript everywhere it's used
- Default to no comments — only add WHY a line exists, never WHAT
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for adding a new parser, hook, or page.

## License

MIT. The architecture and core data model is inspired by the open-source pieces of [TokenTracker](https://github.com/mm7894215/TokenTracker); the Token Board name, multi-tenant model, OpenRouter integration, native menu bar app, and per-source leaderboard are net-new in this fork.
