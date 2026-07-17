# @tokenboard/contract

The **ingest contract** between the CLI (uploader) and the web app (ingest API). Because
the CLI is CommonJS and the web app is ESM/TypeScript, the contract is deliberately kept
as two behavioural twins rather than one shared import:

- `apps/web/src/lib/contract.ts` — authoritative TypeScript copy (web)
- `apps/cli/src/lib/buckets.js` — CommonJS twin (CLI)

`test/parity.test.js` in this package requires both and asserts they produce identical
results across a shared vector of timestamps and inputs. If you change one side without
the other, the parity test fails.

## The contract

- **Bucketing:** usage is aggregated into **UTC half-hour buckets**. `halfHourFloor(ts)`
  floors to `:00` or `:30`; `isHalfHourBoundary(iso)` validates. The ingest API rejects
  any `hour_start` that is not a valid half-hour boundary.
- **Sources:** `claude, codex, cursor, kiro, gemini, opencode, other`. Adding a source =
  update both twins **and** add a `<source>_tokens` column to `tb_leaderboard_snapshots`
  and the leaderboard service.
- **Device-token auth:** the CLI sends `Authorization: Bearer <raw device token>`. The
  server stores only `sha256hex(raw)` (`hashToken`). Raw token is shown to the CLI once.
- **Privacy invariant:** a bucket carries only numeric token columns +
  `source/model/hour_start/conversation_count`. Never message content, filenames, or
  prompts. The CLI's queue serializer must only ever emit these fields.

Run: `node --test packages/contract/test`
