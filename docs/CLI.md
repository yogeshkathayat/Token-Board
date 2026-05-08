# CLI reference

`tokenboard` is a small Node.js CLI that runs on each engineer's laptop. It detects which AI tools are installed, captures token usage on session-end events (or polls passively), and uploads aggregated half-hour buckets to your team's server.

## Install

The easiest install is the one-liner served from your team's deployment:

```bash
curl -fsSL https://usage.your-company.com/install.sh?code=ABC234 | sh
```

Get the code from the dashboard's **Settings → Devices** page. The script installs the CLI, links your device, installs hooks for every detected AI tool, and offers to start the background daemon. One paste, one yes/no prompt.

Manual install:

```bash
npm install -g tokenboard-cli
tokenboard link ABC234                                  # quick — uses URL from clipboard step
tokenboard init https://usage.your-company.com          # fully interactive
```

Requires Node ≥ 20.

## Commands

### `tokenboard link <CODE>`
Shortest path. Equivalent to `tokenboard init --link-code <CODE> --yes`. Used by the dashboard's one-line install. Auto-installs hooks for everything detected, no prompts.

### `tokenboard init`
Interactive setup. Asks for your backend URL, exchanges a link code, prompts y/n per tool. Flags:

| Flag | Effect |
|---|---|
| `--base-url <URL>` | Pre-fill backend URL (or pass it as the first positional arg) |
| `--link-code <CODE>` | Skip the browser step |
| `--yes`, `-y` | Install hooks for every detected tool, no prompts |
| `--openrouter-key <KEY>` | Pre-populate OpenRouter API key |
| `--no-hooks` | Don't install any hooks (for daemon-only setups) |

Examples:

```bash
tokenboard init https://usage.acme.com                                     # interactive
tokenboard init https://usage.acme.com --link-code ABC234 --yes            # unattended
tokenboard init https://usage.acme.com --link-code ABC234 --yes --no-hooks # daemon only
```

```bash
$ tokenboard init
Backend URL: https://usage.acme.com
1) Open https://usage.acme.com/settings/devices to generate a link code
2) Paste the link code: ABC234
✓ Linked device "yogesh-mbp"
Detected: claude, gemini, codex
Install Claude Code SessionEnd hook? [Y/n] y
✓ Claude Code hook installed
...
```

Skip `Y`/`n` prompts with `--yes` (TBD — currently interactive).

### `tokenboard sync`
Parses every detected source, appends new buckets to the local queue, and uploads the queue to the server in batches. Honors throttle/backoff state — pass `--force` (or `--drain`) to override.

Hooks invoke this command after each AI session, but you can run it anytime.

```bash
$ tokenboard sync
✓ Sync complete. Inserted 4, skipped 0.
```

Flags:
- `--force` / `--drain` — skip throttle, drain everything
- `--quiet` — only emit errors (used by hooks)
- `--debug` — verbose logs to stderr

### `tokenboard status`
Prints local state: queue size, last sync time, throttle state, detected tools.

```bash
$ tokenboard status
tokenboard status
───────────────────
backend     : https://usage.acme.com
device      : 8e1d…d2
queue bytes : 0 (offset=12849)
last success: 2026-05-07T11:34:52.103Z
next allowed: 2026-05-07T11:44:52.103Z
backoff step: 0

detected tools:
  claude     ✓
  codex      ·
  gemini     ✓
  opencode   ·
```

### `tokenboard doctor`
Health check: config sanity, backend reachable, device token still valid.

### `tokenboard openrouter login | logout | status`
Manage the OpenRouter API key. Stored in the OS keychain via `keytar` when available, else AES-GCM encrypted in `~/.tokenboard/secrets/`.

```bash
$ tokenboard openrouter login
Paste your OpenRouter API key (sk-or-...): sk-or-v1-…
✓ Stored. Run `tokenboard sync` to fetch usage.
```

OpenRouter usage is captured by paginating `GET /api/v1/generation` since the last seen `id` (stored at `~/.tokenboard/openrouter.cursor.json`). Up to 5 pages per sync — large backlogs catch up over multiple syncs.

### `tokenboard serve [--port=7680]`
Local development helper. Serves a tiny HTTP page on `127.0.0.1:7680` exposing the queue contents and throttle state. Not the real dashboard — that lives on your team's hosted instance.

### `tokenboard daemon install | uninstall | status`
Background sync timer that runs `sync` every 10 minutes. Recommended — it ensures Cursor / Copilot / OpenRouter usage is captured even between AI sessions.

| Platform | Mechanism |
|---|---|
| macOS | `launchd` user agent at `~/Library/LaunchAgents/com.tokenboard.sync.plist` |
| Linux | `systemd --user` timer at `~/.config/systemd/user/tokenboard.timer` |

`install` requires a global `npm install -g` first — it refuses to install when invoked via a temporary `npx` path.

```bash
$ tokenboard daemon install
✓ launchd agent installed at /Users/yogesh/Library/LaunchAgents/com.tokenboard.sync.plist
  syncs every 10 min, logs to /Users/yogesh/.tokenboard/tokenboard.log

$ tokenboard daemon status
Daemon: loaded.
-	0	com.tokenboard.sync
Plist: /Users/yogesh/Library/LaunchAgents/com.tokenboard.sync.plist
Logs:  /Users/yogesh/.tokenboard/tokenboard.log
```

### `tokenboard uninstall`
Removes every hook this CLI installed and deletes `~/.tokenboard/`. Asks for confirmation. Does **not** remove the daemon — run `tokenboard daemon uninstall` first.

## Supported AI tools

| Tool | Mechanism | Hook file |
|---|---|---|
| Claude Code | SessionEnd hook | `~/.claude/settings.json` |
| Codex CLI | TOML notify array | `~/.codex/config.toml` |
| Gemini CLI | SessionEnd hook | `~/.gemini/settings.json` |
| OpenCode | Plugin | `~/.config/opencode/plugin/tokenboard.js` |
| Kiro | Passive (SQLite/JSONL) | _none_ — polled on each `sync` |
| Cursor | Passive (auth + API) | _none_ — polled on each `sync` |
| GitHub Copilot | OTel JSONL exporter | _none_ — set `COPILOT_OTEL_FILE_EXPORTER_PATH` |
| OpenRouter | API pagination | _none_ — paste API key |

For OpenCode and Kiro, install the optional `better-sqlite3` peer dep so the CLI can read their local databases:

```bash
npm install -g better-sqlite3
```

## Local files

Everything lives under `~/.tokenboard/` with mode 0600 / 0700:

```
~/.tokenboard/
├── config.json            backend URL, device token, user info
├── queue.jsonl            pending buckets (NDJSON)
├── queue.state.json       byte offset into queue.jsonl
├── cursors.json           per-source incremental parse state
├── upload.throttle.json   backoff / next-allowed-at
├── openrouter.cursor.json last seen OpenRouter generation_id
├── secrets/               AES fallback keychain (Linux without keytar)
├── bin/notify.cjs         hook trampoline
└── tokenboard.log       (reserved — not yet written)
```

Override the location with `TOKENBOARD_HOME=/somewhere/else`.

## Environment

| Var | Default | Description |
|---|---|---|
| `TOKENBOARD_HOME` | `~/.tokenboard` | State directory |
| `TOKENBOARD_BASE_URL` | _(set by `init`)_ | Backend URL — overrides config.json |
| `TOKENBOARD_DEBUG` | _(unset)_ | `1` to enable verbose stderr logs |
| `TOKENBOARD_HTTP_TIMEOUT_MS` | `20000` | HTTP request timeout. `0` disables. |

## Privacy

The CLI never reads or transmits prompt content, response content, or file contents. It captures only:

- Token counts (input, output, cached, reasoning)
- Timestamps (rounded to half-hour UTC boundaries before upload)
- Model identifiers
- Source identifier (which tool emitted the data)
- Subscription markers (e.g., "Claude Max plan", "ChatGPT Pro")

This is enforced at the parser layer — see `apps/cli/src/parsers/` for the exact code paths and add review-and-test gates if you contribute new parsers.

## Troubleshooting

**"Backend URL not configured. Run `tokenboard init` first."**
You haven't run init or `~/.tokenboard/config.json` was deleted. Re-run `init`.

**`sync` says throttled and exits**
Auto-syncs back off after failures. Pass `--force` to bypass, or wait. `tokenboard status` shows when the next attempt is allowed.

**Hooks fire but `status` shows empty queue**
Confirm the hook trampoline at `~/.tokenboard/bin/notify.cjs` exists and is executable. Run a sync manually with `--debug` to see if the parsers found anything.

**OpenRouter sync logs "OpenRouter key rejected"**
The CLI auto-removes invalid keys. Re-run `tokenboard openrouter login` with a fresh key from `https://openrouter.ai/settings/keys`.

**Cursor parser does nothing**
Cursor's usage API requires a paid subscription. The CLI silently skips when it can't authenticate.
