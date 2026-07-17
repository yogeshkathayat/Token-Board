/**
 * TokenBoard ingest contract (web side).
 *
 * This is the authoritative TypeScript copy of the client/server contract. The CLI
 * carries a byte-for-byte behavioural twin at apps/cli/src/lib/buckets.js, and
 * packages/contract/test asserts the two agree. If you change a rule here, change it
 * there too — the parity test will fail otherwise.
 */

/** AI tools TokenBoard can ingest. Adding one = add it here AND to the leaderboard columns. */
export const SOURCES = [
  'claude',
  'codex',
  'cursor',
  'kiro',
  'gemini',
  'opencode',
  'other',
] as const;

export type Source = (typeof SOURCES)[number];

export function isKnownSource(s: string): s is Source {
  return (SOURCES as readonly string[]).includes(s);
}

/** Numeric token columns carried per bucket. NEVER add a content-bearing field here. */
export interface TokenTotals {
  input_tokens: number;
  cached_input_tokens: number;
  cache_creation_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
  billable_total_tokens: number;
}

/** One half-hour usage bucket as uploaded by the CLI. Counts + timestamps only. */
export interface UsageBucket extends TokenTotals {
  source: string;
  model: string;
  /** UTC half-hour boundary ISO string, e.g. 2026-07-17T14:30:00.000Z */
  hour_start: string;
  conversation_count: number;
}

export interface IngestPayload {
  device_id?: string;
  buckets: UsageBucket[];
}

/**
 * Floor a timestamp to its UTC half-hour boundary and return an ISO string.
 * Minutes >= 30 -> :30, else :00; seconds and milliseconds zeroed.
 */
export function halfHourFloor(input: Date | number | string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`halfHourFloor: invalid timestamp ${String(input)}`);
  }
  const minutes = d.getUTCMinutes() >= 30 ? 30 : 0;
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      minutes,
      0,
      0,
    ),
  ).toISOString();
}

/** True iff `iso` is a valid UTC half-hour boundary (minutes 0 or 30, no sub-minute part). */
export function isHalfHourBoundary(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString() !== iso) return false;
  const m = d.getUTCMinutes();
  return (m === 0 || m === 30) && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** Stable dedup key for a bucket row. */
export function bucketKey(source: string, model: string, hourStart: string): string {
  return `${source}|${model}|${hourStart}`;
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

/** True iff `email` is in one of `allowedDomains` (empty list = allow all). */
export function isAllowedEmail(email: string, allowedDomains: string[]): boolean {
  if (!email) return false;
  if (allowedDomains.length === 0) return true;
  return allowedDomains.includes(emailDomain(email));
}
