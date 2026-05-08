import { useApi } from '../hooks/useApi';
import { formatTokens } from '../lib/format';
import { Heatmap } from '../components/Heatmap';
import { TrendChart } from '../components/TrendChart';
import { TopModels } from '../components/TopModels';
import { Limits } from '../components/Limits';

interface SummaryResponse {
  from: string;
  to: string;
  days: number;
  totals: { total_tokens: string };
}

interface DailyResponse {
  data: Array<{ day: string; total_tokens: string }>;
}

interface HeatmapResponse {
  weeks: number;
  data: Array<{ day: string; value: string }>;
}

// Use the browser's local timezone so date boundaries (especially "today")
// align with the user's wallclock — not UTC. The API supports `tz=IANA`
// for boundary alignment.
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** YYYY-MM-DD in the user's local timezone. */
function localDate(date: Date): string {
  // en-CA produces YYYY-MM-DD; restrict to the local tz.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const TODAY = () => localDate(new Date());
const daysAgo = (n: number) => localDate(new Date(Date.now() - n * 86400_000));

// API caps date ranges at USAGE_MAX_DAYS (default 800). Use the safe upper
// bound for the "Total" card.
const ALL_TIME_FROM = () => daysAgo(798);

export function DashboardPage() {
  // Four parallel fetches for the summary cards.
  const today = useApi<SummaryResponse>('/usage/summary', {
    query: { from: TODAY(), to: TODAY(), tz: TZ },
  });
  const sevenDay = useApi<SummaryResponse>('/usage/summary', {
    query: { from: daysAgo(6), to: TODAY(), tz: TZ },
  });
  const thirtyDay = useApi<SummaryResponse>('/usage/summary', {
    query: { from: daysAgo(29), to: TODAY(), tz: TZ },
  });
  const total = useApi<SummaryResponse>('/usage/summary', {
    query: { from: ALL_TIME_FROM(), to: TODAY(), tz: TZ },
  });

  // For "active days" on the 7-day card and "~/day" hint on 30-day:
  const dailyForCounts = useApi<DailyResponse>('/usage/daily', {
    query: { from: daysAgo(29), to: TODAY(), tz: TZ },
  });

  const heatmap = useApi<HeatmapResponse>('/usage/heatmap', { query: { weeks: 52, tz: TZ } });

  const sixDaysAgoStr = daysAgo(6);
  const activeDays7 = (dailyForCounts.data?.data ?? [])
    .filter((d) => d.day >= sixDaysAgoStr && BigInt(d.total_tokens || '0') > 0n).length;
  const avgPerDay30 = (() => {
    const t = total30(thirtyDay.data, dailyForCounts.data);
    return t.activeDays > 0 ? t.total / BigInt(t.activeDays) : 0n;
  })();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-400">
          Your usage
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time view of token consumption across all your linked tools.
        </p>
      </header>

      {/* Top stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={today.data?.totals.total_tokens}
          loading={today.loading}
          highlight
        />
        <StatCard
          label="7-Day"
          value={sevenDay.data?.totals.total_tokens}
          hint={`${activeDays7} active ${activeDays7 === 1 ? 'day' : 'days'}`}
          loading={sevenDay.loading}
        />
        <StatCard
          label="30-Day"
          value={thirtyDay.data?.totals.total_tokens}
          hint={avgPerDay30 > 0n ? `~${formatTokens(avgPerDay30.toString())}/active day` : undefined}
          loading={thirtyDay.loading}
        />
        <StatCard
          label="Total"
          value={total.data?.totals.total_tokens}
          hint="All time"
          loading={total.loading}
        />
      </section>

      <Limits />

      <section>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Heatmap data={heatmap.data} weeks={52} />
        </div>
      </section>

      <TrendChart />

      <TopModels />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  highlight,
  loading,
}: {
  label: string;
  value: string | undefined;
  hint?: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={
        'rounded-2xl border p-5 shadow-sm transition hover:shadow-md ' +
        (highlight
          ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-cyan-50 dark:border-brand-800 dark:from-brand-900/30 dark:to-cyan-900/20'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900')
      }
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={
          'mt-2 font-mono text-2xl font-bold tabular-nums ' +
          (highlight
            ? 'bg-gradient-to-r from-brand-600 to-cyan-600 bg-clip-text text-transparent dark:from-brand-300 dark:to-cyan-300'
            : 'text-slate-900 dark:text-slate-100')
        }
      >
        {loading ? '…' : formatTokens(value)}
      </div>
      {hint && <div className="mt-1.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function total30(
  thirtyDay: SummaryResponse | null,
  daily: DailyResponse | null,
): { total: bigint; activeDays: number } {
  let total = 0n;
  if (thirtyDay) {
    try {
      total = BigInt(thirtyDay.totals.total_tokens);
    } catch {
      /* ignore */
    }
  }
  let activeDays = 0;
  for (const d of daily?.data ?? []) {
    try {
      if (BigInt(d.total_tokens) > 0n) activeDays += 1;
    } catch {
      /* ignore */
    }
  }
  return { total, activeDays };
}
