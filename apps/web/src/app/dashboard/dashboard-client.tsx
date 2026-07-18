'use client';

import { Activity, Cpu, TrendingUp, Zap } from 'lucide-react';
import useSWR from 'swr';

import { AreaChart, BarChart, ChartCard, KPICard, StatsGrid } from '@/components/dashboard';
import { SourceIcon, SOURCE_META } from '@/components/source-icon';
import { UsageHeatmap } from '@/components/usage-heatmap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UsageTotals {
  today: string;
  week: string;
  month: string;
  total: string;
}

interface SourceBreakdown {
  source: string;
  total_tokens: string;
}

interface ModelBreakdown {
  model: string;
  total_tokens: string;
}

interface DayData {
  day: string;
  total_tokens: string;
}

interface HeatmapData {
  tz: string;
  days: DayData[];
}

interface UsageSummary {
  tz: string;
  totals: UsageTotals;
  by_source: SourceBreakdown[];
  by_model: ModelBreakdown[];
  last30: DayData[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatTokens(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function parseTokenString(value: string): number {
  return Number(value) || 0;
}

const SOURCE_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
  gemini: 'Gemini',
  kiro: 'Kiro',
  opencode: 'OpenCode',
  copilot: 'Copilot',
  openrouter: 'OpenRouter',
  other: 'Other',
};

export function DashboardClient() {
  const tz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  const { data, error, isLoading } = useSWR<UsageSummary>(`/api/usage/summary?tz=${encodeURIComponent(tz)}`, fetcher, {
    refreshInterval: 60000,
  });
  const { data: heatmapData, isLoading: heatmapLoading } = useSWR<HeatmapData>(
    `/api/usage/heatmap?tz=${encodeURIComponent(tz)}&days=112`,
    fetcher,
    {
      refreshInterval: 300000,
    }
  );

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          Failed to load usage data. Please try again.
        </CardContent>
      </Card>
    );
  }

  const todayTokens = data?.totals.today || '0';
  const weekTokens = data?.totals.week || '0';
  const monthTokens = data?.totals.month || '0';
  const totalTokens = data?.totals.total || '0';

  const chartData = (data?.last30 || []).map((d) => ({
    date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tokens: parseTokenString(d.total_tokens),
  }));

  const sourceData = (data?.by_source || [])
    .filter((s) => parseTokenString(s.total_tokens) > 0)
    .map((s) => ({
      name: SOURCE_LABELS[s.source] || s.source,
      source: s.source as keyof typeof SOURCE_META,
      value: parseTokenString(s.total_tokens),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topModels = (data?.by_model || [])
    .filter((m) => parseTokenString(m.total_tokens) > 0)
    .sort((a, b) => parseTokenString(b.total_tokens) - parseTokenString(a.total_tokens))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your personal token usage overview</p>
      </div>

      <StatsGrid columns={4}>
        <KPICard
          title="Today"
          value={formatTokens(todayTokens)}
          description="tokens"
          icon={Zap}
          loading={isLoading}
          className="border-l-4 border-l-emerald-500/50"
        />
        <KPICard
          title="This Week"
          value={formatTokens(weekTokens)}
          description="tokens"
          icon={TrendingUp}
          loading={isLoading}
          className="border-l-4 border-l-blue-500/50"
        />
        <KPICard
          title="This Month"
          value={formatTokens(monthTokens)}
          description="tokens"
          icon={Activity}
          loading={isLoading}
          className="border-l-4 border-l-violet-500/50"
        />
        <KPICard
          title="All Time"
          value={formatTokens(totalTokens)}
          description="tokens"
          icon={Cpu}
          loading={isLoading}
          className="border-l-4 border-l-orange-500/50"
        />
      </StatsGrid>

      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <CardTitle>Activity</CardTitle>
          <CardDescription>Your usage pattern over the past 16 weeks</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {heatmapLoading ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              Loading activity...
            </div>
          ) : heatmapData?.days ? (
            <UsageHeatmap days={heatmapData.days} />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No activity data available yet
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Last 30 Days" description="Daily token usage over the past month">
          {isLoading || chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              {isLoading ? 'Loading...' : 'No data available yet'}
            </div>
          ) : (
            <AreaChart
              data={chartData}
              categories={['tokens']}
              index="date"
              height={300}
              valueFormatter={(v) => formatTokens(v)}
              showLegend={false}
            />
          )}
        </ChartCard>

        <ChartCard title="Usage by Tool" description="Token breakdown across AI tools">
          {isLoading || sourceData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              {isLoading ? 'Loading...' : 'No data available yet'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-[280px]">
                <BarChart
                  data={sourceData.map((s) => ({ name: s.name, value: s.value }))}
                  categories={['value']}
                  index="name"
                  height={280}
                  valueFormatter={(v) => formatTokens(v)}
                  showLegend={false}
                  layout="horizontal"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                {sourceData.map((s) => (
                  <div key={s.source} className="flex items-center gap-2 text-sm">
                    <SourceIcon source={s.source} className="text-muted-foreground" />
                    <span className="font-medium" style={{ color: SOURCE_META[s.source]?.color || 'currentColor' }}>
                      {s.name}
                    </span>
                    <span className="text-muted-foreground text-xs">{formatTokens(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {topModels.length > 0 && (
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
            <CardTitle>Top Models</CardTitle>
            <CardDescription>Most used models by token count</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {topModels.map((model, idx) => {
                const tokens = parseTokenString(model.total_tokens);
                const maxTokens = parseTokenString(topModels[0].total_tokens);
                const percentage = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;

                const sourceFromModel = data?.by_source.find((s) =>
                  model.model.toLowerCase().includes(s.source.toLowerCase())
                )?.source as keyof typeof SOURCE_META | undefined;

                return (
                  <div key={`${model.model}-${idx}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {sourceFromModel && <SourceIcon source={sourceFromModel} className="text-muted-foreground" />}
                        <span className="font-medium">{model.model}</span>
                      </div>
                      <span className="text-muted-foreground font-mono">{formatTokens(model.total_tokens)}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted relative">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
