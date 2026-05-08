import { useMemo } from 'react';

import { useApi } from '../hooks/useApi';
import { formatTokens, formatTokensCompact } from '../lib/format';
import { SourceIcon } from './SourceIcon';

interface ModelBreakdown {
  sources: Array<{
    source: string;
    totals: { total_tokens: string };
    models: Array<{ source: string; model: string; total_tokens: string }>;
  }>;
}

const TOP_N = 6;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function daysAgo(n: number): string {
  return localDate(new Date(Date.now() - n * 86400_000));
}

const KNOWN = new Set([
  'claude',
  'codex',
  'gemini',
  'opencode',
  'kiro',
  'cursor',
  'copilot',
  'openrouter',
]);

/**
 * Top N models by tokens in the last 30 days, with each model's % share.
 */
export function TopModels() {
  const { data, loading } = useApi<ModelBreakdown>('/usage/model-breakdown', {
    query: { from: daysAgo(29), to: localDate(new Date()), tz: TZ },
  });

  const items = useMemo(() => {
    const empty = { rows: [] as { source: string; model: string; tokens: bigint }[], total: 0n };
    if (!data) return empty;
    const all: { source: string; model: string; tokens: bigint }[] = [];
    for (const src of data.sources) {
      for (const m of src.models) {
        try {
          all.push({ source: src.source, model: m.model, tokens: BigInt(m.total_tokens) });
        } catch {
          /* skip */
        }
      }
    }
    all.sort((a, b) => (b.tokens > a.tokens ? 1 : b.tokens < a.tokens ? -1 : 0));
    const total = all.reduce((acc, m) => acc + m.tokens, 0n);
    return { rows: all.slice(0, TOP_N), total };
  }, [data]);

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Top models
      </h3>
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!loading && items.rows.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-500">No model usage yet.</div>
        )}
        {!loading && items.rows.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.rows.map((row) => {
              const pct = items.total === 0n ? 0 : Number((row.tokens * 10000n) / items.total) / 100;
              const sourceKey = (KNOWN.has(row.source) ? row.source : 'other') as Parameters<typeof SourceIcon>[0]['source'];
              return (
                <li key={`${row.source}-${row.model}`} className="flex items-center gap-3 px-3 py-2.5">
                  <SourceIcon source={sourceKey} size={20} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.model}</div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium tabular-nums">
                      {formatTokensCompact(row.tokens.toString())}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">{pct.toFixed(1)}%</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
