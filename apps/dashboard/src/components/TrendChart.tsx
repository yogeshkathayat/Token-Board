import { useId, useMemo, useState } from 'react';

import { useApi } from '../hooks/useApi';
import { formatTokens, formatTokensCompact } from '../lib/format';

type Period = 'day' | 'week' | 'month' | 'total';

interface DailyResponse {
  data: Array<{ day: string; total_tokens: string }>;
}

interface MonthlyResponse {
  data: Array<{ month: string; total_tokens: string }>;
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const TODAY = () => localDate(new Date());

function daysAgo(n: number): string {
  return localDate(new Date(Date.now() - n * 86400_000));
}

function monthLabel(s: string): string {
  // s = "YYYY-MM"
  const [y, m] = s.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function dayLabel(s: string): string {
  const d = new Date(s + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Smooth area-line chart over a configurable time window.
 *   day    → last 7 days, daily resolution
 *   week   → last 4 weeks, daily resolution
 *   month  → last 12 months, monthly resolution
 *   total  → last 24 months, monthly resolution
 */
export function TrendChart() {
  const [period, setPeriod] = useState<Period>('week');

  const queryParams = useMemo(() => {
    if (period === 'day') return { kind: 'daily' as const, from: daysAgo(6), to: TODAY() };
    if (period === 'week') return { kind: 'daily' as const, from: daysAgo(27), to: TODAY() };
    if (period === 'month') return { kind: 'monthly' as const, months: 12 };
    return { kind: 'monthly' as const, months: 24 };
  }, [period]);

  const dailyApi = useApi<DailyResponse>(
    queryParams.kind === 'daily' ? '/usage/daily' : null,
    queryParams.kind === 'daily'
      ? { query: { from: queryParams.from, to: queryParams.to, tz: TZ } }
      : {},
  );
  const monthlyApi = useApi<MonthlyResponse>(
    queryParams.kind === 'monthly' ? '/usage/monthly' : null,
    queryParams.kind === 'monthly' ? { query: { months: queryParams.months, tz: TZ } } : {},
  );

  const points = useMemo(() => {
    if (queryParams.kind === 'daily' && dailyApi.data) {
      return dailyApi.data.data.map((d) => ({ label: dayLabel(d.day), value: d.total_tokens, full: d.day }));
    }
    if (queryParams.kind === 'monthly' && monthlyApi.data) {
      return monthlyApi.data.data.map((d) => ({ label: monthLabel(d.month), value: d.total_tokens, full: d.month }));
    }
    return [];
  }, [queryParams, dailyApi.data, monthlyApi.data]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Trend
        </h3>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
          {(['day', 'week', 'month', 'total'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                'rounded-md px-3 py-1 font-medium transition ' +
                (period === p
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {p[0]!.toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {points.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {dailyApi.loading || monthlyApi.loading ? 'Loading…' : 'No data in this window.'}
          </div>
        ) : (
          <AreaChart points={points} />
        )}
      </div>
    </section>
  );
}

function AreaChart({ points }: { points: { label: string; value: string; full: string }[] }) {
  const id = useId().replace(/:/g, '');
  const W = 800;
  const H = 220;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const max = points.reduce((m, p) => {
    const v = Number(p.value) || 0;
    return v > m ? v : m;
  }, 0);
  const safeMax = max === 0 ? 1 : max;

  const xFor = (i: number) =>
    padL + ((W - padL - padR) * (points.length === 1 ? 0 : i / (points.length - 1)));
  const yFor = (v: number) => padT + (H - padT - padB) * (1 - v / safeMax);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)} ${yFor(Number(p.value) || 0).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)} ${(H - padB).toFixed(1)} L${xFor(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  // Y gridlines + labels
  const ticks = 4;
  const gridLines = Array.from({ length: ticks + 1 }, (_, k) => {
    const v = (safeMax * k) / ticks;
    return { y: yFor(v), value: v };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
      <defs>
        <linearGradient id={`tb-area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`tb-line-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={g.y}
            y2={g.y}
            stroke="currentColor"
            strokeOpacity={i === 0 ? 0.25 : 0.08}
            strokeDasharray={i === 0 ? undefined : '3 4'}
            className="text-slate-400"
          />
          <text
            x={padL - 6}
            y={g.y + 3}
            textAnchor="end"
            className="fill-slate-400 text-[10px] tabular-nums"
          >
            {formatTokensCompact(BigInt(Math.floor(g.value)).toString())}
          </text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#tb-area-${id})`} />
      <path d={linePath} fill="none" stroke={`url(#tb-line-${id})`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i} className="group">
          <circle
            cx={xFor(i)}
            cy={yFor(Number(p.value) || 0)}
            r="3"
            className="fill-white stroke-brand-500 transition group-hover:r-4 dark:fill-slate-900"
            strokeWidth="2"
          />
          <title>{`${p.full}: ${formatTokens(p.value)}`}</title>
        </g>
      ))}
      {points.map((p, i) => {
        const showEvery = Math.max(1, Math.ceil(points.length / 8));
        if (i % showEvery !== 0 && i !== points.length - 1) return null;
        return (
          <text
            key={`l-${i}`}
            x={xFor(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[10px]"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}
