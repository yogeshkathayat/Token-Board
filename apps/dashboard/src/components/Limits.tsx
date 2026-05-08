import { useMemo } from 'react';

import { useApi } from '../hooks/useApi';
import { formatTokensCompact } from '../lib/format';
import { SourceIcon, sourceLabel } from './SourceIcon';

interface LimitsResponse {
  subscriptions: Array<{
    tool: string;
    plan_type: string | null;
  }>;
}

interface HourlyResponse {
  day: string;
  data: Array<{ hour: string; total_tokens: string }>;
}

interface DailyResponse {
  data: Array<{ day: string; total_tokens: string }>;
}

const KNOWN_TOOLS = ['claude', 'codex', 'gemini', 'opencode', 'kiro', 'cursor', 'copilot', 'openrouter'] as const;
type Tool = (typeof KNOWN_TOOLS)[number];

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Best-effort utilization view. Real Anthropic/OpenAI rate-limit APIs vary
 * per tool — for now we visualize *usage in the recent window* against a
 * simple heuristic ceiling (the rolling P95 of past windows). Subscription
 * markers reported by ingest are shown alongside.
 *
 * This is approximation, not a billing primitive. The card is labelled as
 * such. Real per-tool limit APIs are a v2 follow-up.
 */
export function Limits() {
  const today = localDate(new Date());
  const { data: subs } = useApi<LimitsResponse>('/usage/limits');
  const { data: hourly } = useApi<HourlyResponse>('/usage/hourly', { query: { day: today, tz: TZ } });
  const { data: daily } = useApi<DailyResponse>('/usage/daily', {
    query: {
      from: localDate(new Date(Date.now() - 14 * 86400_000)),
      to: today,
      tz: TZ,
    },
  });

  const usage = useMemo(() => {
    // last 5 hours (current day's most recent half-hour buckets, summed)
    let last5h = 0n;
    if (hourly?.data) {
      const now = Date.now();
      for (const h of hourly.data) {
        const t = new Date(h.hour + 'Z').getTime();
        if (now - t <= 5 * 3600_000) {
          try { last5h += BigInt(h.total_tokens); } catch { /* ignore */ }
        }
      }
    }
    // last 7 days
    let last7d = 0n;
    if (daily?.data) {
      const cut = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      for (const d of daily.data) {
        if (d.day >= cut) {
          try { last7d += BigInt(d.total_tokens); } catch { /* ignore */ }
        }
      }
    }
    // P95-ish heuristic: max daily × 5 over the 14-day window as a soft ceiling
    let dailyMax = 0n;
    if (daily?.data) {
      for (const d of daily.data) {
        try {
          const v = BigInt(d.total_tokens);
          if (v > dailyMax) dailyMax = v;
        } catch { /* ignore */ }
      }
    }
    const ceiling5h = dailyMax === 0n ? 1_000_000n : dailyMax / 4n + 1n;
    const ceiling7d = dailyMax === 0n ? 7_000_000n : dailyMax * 10n;
    return { last5h, last7d, ceiling5h, ceiling7d };
  }, [hourly, daily]);

  const subsByTool = new Map<string, string>();
  for (const s of subs?.subscriptions ?? []) {
    if (s.tool && s.plan_type) subsByTool.set(s.tool, s.plan_type);
  }

  // Show only tools that have either a subscription OR have usage today/this week.
  const tools = KNOWN_TOOLS.filter((t) => subsByTool.has(t));
  if (tools.length === 0 && (usage.last5h > 0n || usage.last7d > 0n)) {
    tools.push('claude');
  }

  if (tools.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Limits
      </h3>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {tools.map((tool) => (
          <ToolRow
            key={tool}
            tool={tool}
            plan={subsByTool.get(tool) ?? null}
            used5h={usage.last5h}
            used7d={usage.last7d}
            ceil5h={usage.ceiling5h}
            ceil7d={usage.ceiling7d}
          />
        ))}
        <p className="pt-2 text-[11px] text-slate-400 dark:text-slate-500">
          Heuristic — approximate utilization vs a rolling ceiling. Real rate-limit APIs are tool-specific.
        </p>
      </div>
    </section>
  );
}

function ToolRow({
  tool,
  plan,
  used5h,
  used7d,
  ceil5h,
  ceil7d,
}: {
  tool: Tool;
  plan: string | null;
  used5h: bigint;
  used7d: bigint;
  ceil5h: bigint;
  ceil7d: bigint;
}) {
  const pct5h = ceil5h === 0n ? 0 : Number((used5h * 10000n) / ceil5h) / 100;
  const pct7d = ceil7d === 0n ? 0 : Number((used7d * 10000n) / ceil7d) / 100;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <SourceIcon source={tool} size={20} />
        <span className="font-medium">{sourceLabel(tool)}</span>
        {plan && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {plan}
          </span>
        )}
      </div>
      <Bar label="5h" pct={pct5h} value={used5h} />
      <Bar label="7d" pct={pct7d} value={used7d} />
    </div>
  );
}

function Bar({ label, pct, value }: { label: string; pct: number; value: bigint }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const tone = clamped > 80 ? 'from-rose-500 to-orange-500' : clamped > 50 ? 'from-amber-400 to-amber-500' : 'from-emerald-400 to-emerald-500';
  return (
    <div className="mt-1.5 flex items-center gap-3">
      <span className="w-7 text-xs font-semibold tabular-nums text-slate-500">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: `${Math.max(2, clamped)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
        {clamped.toFixed(0)}%
      </span>
      <span className="w-16 text-right text-xs font-mono tabular-nums text-slate-400">
        {formatTokensCompact(value.toString())}
      </span>
    </div>
  );
}
