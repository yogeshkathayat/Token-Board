/**
 * Timezone-aware date helpers. Read endpoints accept either an IANA
 * timezone (`tz=America/Los_Angeles`) or a fixed offset (`tz_offset_minutes=-480`).
 * Date boundaries are interpreted in that zone, but storage is always UTC.
 *
 * For correctness without bringing in `luxon` or `date-fns-tz`, we use the
 * Intl API for IANA conversions and plain math for fixed offsets.
 */
import { config } from '../config.js';

export interface TzInfo {
  iana: string | null;
  offsetMinutes: number | null;
}

export function parseTz(query: { tz?: string; tz_offset_minutes?: string | number }): TzInfo {
  if (query.tz && typeof query.tz === 'string') {
    return { iana: query.tz, offsetMinutes: null };
  }
  if (query.tz_offset_minutes !== undefined) {
    const n = Number(query.tz_offset_minutes);
    if (Number.isFinite(n)) return { iana: null, offsetMinutes: Math.trunc(n) };
  }
  return { iana: null, offsetMinutes: 0 };
}

/** Format a Date as YYYY-MM-DD in the requested timezone. */
export function formatLocalDate(d: Date, tz: TzInfo): string {
  if (tz.iana) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz.iana,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  const offset = tz.offsetMinutes ?? 0;
  const shifted = new Date(d.getTime() + offset * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function todayLocal(tz: TzInfo): string {
  return formatLocalDate(new Date(), tz);
}

export function daysAgoLocal(daysBack: number, tz: TzInfo): string {
  const d = new Date(Date.now() - daysBack * 86400_000);
  return formatLocalDate(d, tz);
}

export function parseDate(s: string | undefined, fallback: string): string {
  if (!s) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw Object.assign(new Error(`Invalid date: ${s}`), { statusCode: 400 });
  }
  return s;
}

export function rangeDays(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((t - f) / 86400_000) + 1);
}

export function assertRangeWithinMax(from: string, to: string): void {
  const days = rangeDays(from, to);
  if (days > config.usageMaxDays) {
    throw Object.assign(new Error(`Date range too large (max ${config.usageMaxDays} days)`), { statusCode: 400 });
  }
}

/**
 * SQL fragment for converting a UTC timestamp to a YYYY-MM-DD string in the
 * requested timezone. Returns the SQL text and parameters separately so it
 * can be inlined into Kysely raw SQL.
 */
export function pgLocalDateExpr(tz: TzInfo, column = 'hour_start'): { sql: string; param: unknown } {
  if (tz.iana) {
    return { sql: `to_char((${column} at time zone ?), 'YYYY-MM-DD')`, param: tz.iana };
  }
  const offset = tz.offsetMinutes ?? 0;
  // Postgres `interval` arithmetic — shift by minutes.
  return { sql: `to_char((${column} + (? || ' minutes')::interval), 'YYYY-MM-DD')`, param: offset };
}
