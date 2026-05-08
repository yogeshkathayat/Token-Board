# tokenboard CLI

Self-hosted AI token usage tracker — captures token counts from your AI coding tools (Claude Code, Codex, Gemini, OpenCode, Kiro, Cursor, GitHub Copilot, OpenRouter) and uploads aggregated half-hour buckets to your team's `tokenboard` server.

## Install

```bash
npm install -g tokenboard-cli
# or
npx tokenboard init
```

## Quick start

```bash
# Link this device to your team's server
tokenboard init

# Manually trigger a sync
tokenboard sync

# Inspect local state
tokenboard status

# Health check
tokenboard doctor

# Track OpenRouter API usage too
tokenboard openrouter login

# Remove all hooks and config
tokenboard uninstall
```

## What it tracks

Token *counts* and timestamps only — never prompt content, response content, file contents, or filenames. See the privacy notes in the main repo's [SECURITY.md](../../docs/SECURITY.md).

| Tool | How |
|---|---|
| Claude Code | SessionEnd hook in `~/.claude/settings.json` |
| Codex CLI | TOML notify array in `~/.codex/config.toml` |
| Gemini CLI | SessionEnd hook in `~/.gemini/settings.json` |
| OpenCode | Plugin file at `~/.config/opencode/plugin/tokenboard.js` |
| Kiro | Passive read of local SQLite |
| Cursor | Passive read of session token + Cursor's usage API |
| GitHub Copilot | OTel JSONL at `$COPILOT_OTEL_FILE_EXPORTER_PATH` |
| OpenRouter | Paginated `/api/v1/generation` poll (requires API key) |

## Local state

All state lives under `~/.tokenboard/` with mode 0600 / 0700:

```
config.json              backend URL, device token (treat as sensitive)
queue.jsonl              pending usage buckets
queue.state.json         upload progress
cursors.json             per-source incremental parser state
upload.throttle.json     backoff/retry state
secrets/                 encrypted fallback for OpenRouter key when keytar absent
bin/notify.cjs           hook trampoline (spawned by AI tools on session end)
```

To override the default location: `export TOKENBOARD_HOME=/path/to/dir`.

## Environment variables

- `TOKENBOARD_BASE_URL` — backend URL (set by `init`)
- `TOKENBOARD_DEBUG=1` — verbose logs to stderr
- `TOKENBOARD_HTTP_TIMEOUT_MS` — HTTP timeout, default 20000

## License

MIT
