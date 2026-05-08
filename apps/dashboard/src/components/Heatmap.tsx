import { useMemo } from 'react';

import { formatTokens } from '../lib/format';

interface Day {
  day: string; // YYYY-MM-DD
  value: string; // bigint as string
}

interface HeatmapResponse {
  weeks: number;
  data: Day[];
}

/**
 * GitHub-style 52-week × 7-day grid. Cells are colored by quartile.
 *
 * Buckets are clipped to the most recent N weeks; the grid is constructed
 * from `to` (today) backwards so the rightmost column is always "this week".
 */
export function Heatmap({
  data,
  weeks = 52,
  weekStartsOn = 0, // 0=Sun
}: {
  data: HeatmapResponse | null;
  weeks?: number;
  weekStartsOn?: 0 | 1;
}) {
  const cells = useMemo(() => buildGrid(data?.data ?? [], weeks, weekStartsOn), [data, weeks, weekStartsOn]);
  const max = useMemo(
    () => cells.reduce((m, c) => (c && BigInt(c.value) > BigInt(m) ? c.value : m), '0'),
    [cells],
  );
  const activeDays = useMemo(
    () => cells.filter((c) => c && BigInt(c.value) > 0n).length,
    [cells],
  );

  const cellsByCol: ((Day & { col: number; row: number }) | null)[][] = [];
  for (const c of cells) {
    if (!c) continue;
    const list = (cellsByCol[c.col] ||= []);
    list[c.row] = c;
  }
  // Pad incomplete columns with nulls so each column has 7 entries.
  for (let i = 0; i < cellsByCol.length; i += 1) {
    const list = (cellsByCol[i] ||= []);
    for (let r = 0; r < 7; r += 1) if (!list[r]) list[r] = null as never;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Activity
        </h3>
        <span className="text-xs text-slate-500">
          {activeDays} active {activeDays === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]">
          {cellsByCol.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-[3px]">
              {col.map((c, ri) => (
                <Cell key={ri} cell={c} max={max} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
        <span>Less</span>
        <Swatch level={0} />
        <Swatch level={1} />
        <Swatch level={2} />
        <Swatch level={3} />
        <Swatch level={4} />
        <span>More</span>
      </div>
    </div>
  );
}

function Cell({ cell, max }: { cell: (Day & { col: number; row: number }) | null; max: string }) {
  if (!cell) return <span className="block h-3 w-3 rounded-[2px]" />;
  const level = bucket(cell.value, max);
  return (
    <span
      title={`${cell.day}: ${formatTokens(cell.value)} tokens`}
      className={'block h-3 w-3 rounded-[2px] transition hover:ring-2 hover:ring-brand-400 ' + LEVEL_CLASS[level]}
    />
  );
}

function Swatch({ level }: { level: number }) {
  return <span className={'block h-3 w-3 rounded-[2px] ' + LEVEL_CLASS[level]} />;
}

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-slate-200 dark:bg-slate-800',
  1: 'bg-brand-200 dark:bg-brand-900',
  2: 'bg-brand-400 dark:bg-brand-700',
  3: 'bg-brand-500 dark:bg-brand-500',
  4: 'bg-brand-600 dark:bg-brand-400',
};

function bucket(value: string, max: string): number {
  let v: bigint;
  let m: bigint;
  try {
    v = BigInt(value);
    m = BigInt(max);
  } catch {
    return 0;
  }
  if (v === 0n || m === 0n) return 0;
  // Log-ish quartiles so a single huge day doesn't make everything else look empty.
  const ratio = Number(v) / Number(m);
  if (ratio < 0.05) return 1;
  if (ratio < 0.2) return 2;
  if (ratio < 0.5) return 3;
  return 4;
}

interface CellPos {
  day: string;
  value: string;
  col: number;
  row: number;
}

function buildGrid(rows: Day[], weeks: number, weekStartsOn: 0 | 1): (CellPos | null)[] {
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.day, r.value);

  const out: (CellPos | null)[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Find the end-of-week aligned column for today.
  const todayDow = today.getUTCDay(); // 0=Sun..6=Sat
  const offsetToWeekStart = (todayDow - weekStartsOn + 7) % 7;
  const lastSunday = new Date(today.getTime() - offsetToWeekStart * 86400_000);

  for (let col = 0; col < weeks; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const offsetDays = (weeks - 1 - col) * 7 + (6 - row); // most recent in last col
      const date = new Date(lastSunday.getTime() + (6 - offsetDays) * 86400_000);
      if (date > today) {
        out.push(null);
        continue;
      }
      const key = date.toISOString().slice(0, 10);
      out.push({ day: key, value: map.get(key) ?? '0', col, row });
    }
  }
  return out;
}
