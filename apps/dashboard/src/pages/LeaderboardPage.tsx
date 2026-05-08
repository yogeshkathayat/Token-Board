import { useState } from 'react';

import { useApi } from '../hooks/useApi';
import { formatTokens } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { SourceIcon, sourceLabel } from '../components/SourceIcon';

type Period = 'week' | 'month' | 'total';
const SOURCES = [
  'claude',
  'codex',
  'gemini',
  'opencode',
  'kiro',
  'cursor',
  'copilot',
  'openrouter',
] as const;
type Source = (typeof SOURCES)[number];

type TokensFields = {
  claude_tokens: string;
  codex_tokens: string;
  gemini_tokens: string;
  opencode_tokens: string;
  kiro_tokens: string;
  cursor_tokens: string;
  copilot_tokens: string;
  openrouter_tokens: string;
  other_tokens: string;
  total_tokens: string;
};

interface Entry extends TokensFields {
  user_id: string | null;
  rank: number;
  is_me: boolean;
  is_public: boolean;
  display_name: string;
  avatar_url: string | null;
}

interface LeaderboardResponse {
  period: Period;
  from: string;
  to: string;
  page: number;
  total_pages: number;
  total_entries: number;
  entries: Entry[];
  me: (TokensFields & { rank: number | null }) | null;
}

const PAGE_SIZE = 20;
const ALL_SOURCES: readonly (Source | 'other')[] = [...SOURCES, 'other'];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('week');
  const [page, setPage] = useState(1);

  const { data, loading } = useApi<LeaderboardResponse>('/leaderboard', {
    query: { period, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-400">
            Leaderboard
          </h1>
          {data && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {data.from === '1970-01-01' ? 'All time' : `${data.from} → ${data.to}`}
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              {data.total_entries} {data.total_entries === 1 ? 'user' : 'users'}
            </p>
          )}
        </div>
        <PeriodSelect value={period} onChange={(v) => { setPeriod(v); setPage(1); }} />
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <th className="w-16 px-4 py-3.5 text-center">#</th>
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5 text-right">
                  <span className="text-slate-700 dark:text-slate-200">Total</span>
                </th>
                {ALL_SOURCES.map((s) => (
                  <th key={s} className="px-3 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <SourceIcon source={s} size={16} />
                      <span>{sourceLabel(s)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3 + ALL_SOURCES.length} className="px-4 py-12 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data?.entries.length === 0 && (
                <tr>
                  <td colSpan={3 + ALL_SOURCES.length} className="px-4 py-12 text-center text-sm text-slate-500">
                    No usage in this window yet.
                  </td>
                </tr>
              )}
              {data?.entries.map((entry) => (
                <Row key={`${entry.rank}-${entry.user_id ?? 'anon'}`} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">
            ← Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {data.total_pages}
          </span>
          <button onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))} disabled={page >= data.total_pages} className="btn-secondary disabled:opacity-50">
            Next →
          </button>
        </div>
      )}

      {data?.me && (
        <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-cyan-50 p-4 text-sm dark:border-brand-800 dark:from-brand-900/30 dark:to-cyan-900/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-brand-700/80 dark:text-brand-300/80">
                Your rank
              </div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {data.me.rank ?? '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-brand-700/80 dark:text-brand-300/80">
                Your tokens
              </div>
              <div className="mt-0.5 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatTokens(data.me.total_tokens)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ entry }: { entry: Entry }) {
  return (
    <tr
      className={
        'border-t border-slate-100 transition dark:border-slate-800 ' +
        (entry.is_me
          ? 'bg-gradient-to-r from-brand-50/60 to-cyan-50/30 dark:from-brand-900/30 dark:to-cyan-900/10'
          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40')
      }
    >
      <td className="px-4 py-3 text-center">
        <RankBadge rank={entry.rank} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={entry.display_name} seed={entry.user_id ?? entry.display_name} size={32} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {entry.display_name}
              {entry.is_me && (
                <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  You
                </span>
              )}
            </span>
            <span className="text-xs text-slate-500">
              {entry.is_public ? 'Public profile' : 'Private'}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-base font-bold text-slate-900 tabular-nums dark:text-slate-100">
          {formatTokens(entry.total_tokens)}
        </span>
      </td>
      {ALL_SOURCES.map((s) => {
        const col = `${s}_tokens` as keyof TokensFields;
        const v = entry[col] ?? '0';
        const isZero = (() => {
          try { return BigInt(v) === 0n; } catch { return true; }
        })();
        return (
          <td key={s} className="px-3 py-3 text-right">
            <span
              className={
                'font-mono tabular-nums ' +
                (isZero
                  ? 'text-slate-300 dark:text-slate-600'
                  : 'text-slate-700 dark:text-slate-200')
              }
            >
              {formatTokens(v)}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-xs font-bold text-amber-900 shadow-sm">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-xs font-bold text-slate-700 shadow-sm">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-amber-600 text-xs font-bold text-orange-900 shadow-sm">
        3
      </span>
    );
  }
  return (
    <span className="font-mono text-sm text-slate-400 tabular-nums dark:text-slate-500">
      {rank}
    </span>
  );
}

function PeriodSelect({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const opts: { v: Period; l: string }[] = [
    { v: 'week', l: 'Week' },
    { v: 'month', l: 'Month' },
    { v: 'total', l: 'All time' },
  ];
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={
            'rounded-lg px-4 py-1.5 text-sm font-medium transition ' +
            (value === o.v
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
          }
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
