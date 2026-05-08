/**
 * Floor a Date or ISO timestamp to the nearest UTC half-hour boundary (:00 or :30).
 * Mirrors `toUtcHalfHourStart` in the upstream rollout parser so that buckets
 * produced by the CLI line up with the partitioning scheme used by the API.
 */
export function halfHourFloor(input: Date | string | number): string {
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) {
    throw new RangeError(`halfHourFloor: invalid date ${String(input)}`);
  }
  const minutes = dt.getUTCMinutes() >= 30 ? 30 : 0;
  return new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      minutes,
      0,
      0,
    ),
  ).toISOString();
}

export function isHalfHourBoundary(iso: string): boolean {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  if (dt.getUTCSeconds() !== 0 || dt.getUTCMilliseconds() !== 0) return false;
  const m = dt.getUTCMinutes();
  return m === 0 || m === 30;
}
