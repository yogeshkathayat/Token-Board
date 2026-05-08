/**
 * Deterministic gradient avatar — same input always produces the same colors.
 * Used in the top bar and leaderboard rows to give each user a recognizable
 * visual signature without any external service.
 */
const PALETTES: [string, string][] = [
  ['#6366f1', '#22d3ee'], // indigo → cyan
  ['#8b5cf6', '#ec4899'], // violet → pink
  ['#f59e0b', '#f43f5e'], // amber → rose
  ['#10b981', '#06b6d4'], // emerald → cyan
  ['#3b82f6', '#a855f7'], // blue → purple
  ['#ef4444', '#f59e0b'], // red → amber
  ['#0ea5e9', '#22c55e'], // sky → green
  ['#a855f7', '#0ea5e9'], // purple → sky
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  seed,
  size = 28,
}: {
  name?: string | null;
  seed?: string | null;
  size?: number;
}) {
  const key = seed || name || 'anon';
  const [a, b] = PALETTES[hash(key) % PALETTES.length]!;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase text-white shadow-sm"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        fontSize: Math.max(10, Math.floor(size * 0.4)),
      }}
    >
      {initials(name)}
    </span>
  );
}
