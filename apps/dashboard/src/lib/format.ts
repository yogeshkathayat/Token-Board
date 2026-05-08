/** Format a bigint-as-string token count with thousands separators. */
export function formatTokens(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '—';
  let n: bigint;
  try {
    n = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    return String(value);
  }
  return n.toLocaleString('en-US');
}

/** Compact form for cards — 1.2M, 24.5K, etc. */
export function formatTokensCompact(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined) return '—';
  let n: bigint;
  try {
    n = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    return String(value);
  }
  const abs = n < 0n ? -n : n;
  if (abs < 1_000n) return n.toString();
  if (abs < 1_000_000n) return (Number(n) / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (abs < 1_000_000_000n) return (Number(n) / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (Number(n) / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
}
