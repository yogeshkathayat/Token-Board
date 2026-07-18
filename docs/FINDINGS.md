# TokenBoard — verified findings register (first-cut pipeline pass)

Produced by an autonomous build + review pass. Findings were raised by parallel reviewers
(security, correctness, CLI/infra) and verified against the code before landing here.

## Gate status (this pass)

| Gate | Result |
|---|---|
| Web typecheck | ✅ pass |
| Web `next build` (standalone) | ✅ pass |
| Web unit tests | ✅ 10/10 |
| CLI tests | ✅ 27/27 (incl. privacy + incrementality) |
| Contract parity | ✅ 5/5 |
| macOS menu bar `swiftc` build | ✅ compiles + install/uninstall verified |
| `docker compose config` | ✅ validates |
| **Live DB end-to-end (ingest→leaderboard)** | ✅ **PASS** — real Postgres + `migrate.mjs` + standalone server: device-token → ingest → refresh → leaderboard → usage round-trip; bad boundary → 400, unauth → 401, prod-bypass correctly refused without the explicit flag |

## Fixed in this pass

Security: prod `AUTH_BYPASS` guard (`AUTH_BYPASS_ALLOW_IN_PROD` acknowledgment required);
CSPRNG + atomic single-use link codes; constant-time refresh-secret compare + 30s debounce;
removed unauthenticated `/api/dev-tools`; logger no longer logs cookies/session; CLI config 0600 on create.
Correctness: timezone-correct `usage.ts` (was 500 for non-UTC users) + zero-filled `last30`;
transactional + deterministic leaderboard refresh; day-boundary-tolerant leaderboard reads;
removed fake-email profile insert in ingest; guarded pages forced dynamic.
Deploy: plain-Node migrations in the Docker runner; fixed entrypoint COPY (build context);
fail-fast compose secrets; CLI queue compaction after full drain.

## Open findings (recommended for a follow-up fix round)

### Must-do before real production use
1. ✅ **Live DB end-to-end — DONE** (2026-07-18). Full round-trip verified against real
   Postgres. Still worth adding as a CI job so it runs on every change.
2. **Wire real Auth Desk SSO** and set `AUTH_BYPASS=false` (drop `AUTH_BYPASS_ALLOW_IN_PROD`).
   Until then the Docker deploy runs as an insecure single-user demo.

### Medium
3. **Security response headers** — add CSP / HSTS / X-Frame-Options / X-Content-Type-Options
   via `next.config.ts` `headers()`. (`apps/web/next.config.ts`)
4. **Dedicated rate limiting** on public/auth endpoints (`/api/link-code/exchange`, `/api/ingest`)
   beyond the refresh debounce.
5. **CLI `opencode` parser** uses a strict `> time_updated` on a non-unique column → can drop
   rows that share a tick. Key on the unique `id` instead. (`apps/cli/src/parsers/opencode.js`)
6. **CLI throttle `maxBatches` window cap is dead code** — `drainQueueToCloud` sends the whole
   coalesced window; slice to `maxBatches * batchSize` per drain. (`apps/cli/src/lib/uploader.js`)

### Low
7. `cursors.buckets` in `~/.tokenboard/cursors.json` grows unbounded — prune uploaded buckets
   past a retention window. (`apps/cli/src/parsers/index.js`)
8. `gemini` in-place session shrink (same inode, fewer messages) can double-count — treat as a
   full reset of that bucket. (`apps/cli/src/parsers/gemini.js`)
9. `kiro` parser uses `os.homedir()` directly, so it ignores the test home override.
   (`apps/cli/src/parsers/kiro.js`)
10. Dashboard/leaderboard display coerces bigint-strings with `Number()` — precision loss only
    above 2^53 (company "all-time" totals are the most exposed); format from the string instead.
11. Ingest doesn't re-check company membership on each upload; revoke device tokens on offboarding.

## Deferred by scope (agreed at planning)
- Parsers: **kimicode, kilo-cli, kilocode** (references exist; not built this pass).
- Device-flow (SSH/headless) auth; Windows app; extra dashboard pages (achievements/wrapped/pet).
- DB monthly partitioning (single table for v1).
