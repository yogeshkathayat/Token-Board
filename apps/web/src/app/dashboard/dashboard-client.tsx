'use client';

import { Activity, Cpu, TrendingUp, Zap } from 'lucide-react';
import useSWR from 'swr';

import { AreaChart, BarChart, ChartCard, KPICard, StatsGrid } from '@/components/dashboard';
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
      value: parseTokenString(s.total_tokens),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const topModels = (data?.by_model || [])
    .filter((m) => parseTokenString(m.total_tokens) > 0)
    .sort((a, b) => parseTokenString(b.total_tokens) - parseTokenString(a.total_tokens))
    .slice(0, 5);

  return (
    <div className="space-y-6">
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
        />
        <KPICard
          title="This Week"
          value={formatTokens(weekTokens)}
          description="tokens"
          icon={TrendingUp}
          loading={isLoading}
        />
        <KPICard
          title="This Month"
          value={formatTokens(monthTokens)}
          description="tokens"
          icon={Activity}
          loading={isLoading}
        />
        <KPICard
          title="All Time"
          value={formatTokens(totalTokens)}
          description="tokens"
          icon={Cpu}
          loading={isLoading}
        />
      </StatsGrid>

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
            <BarChart
              data={sourceData}
              categories={['value']}
              index="name"
              height={300}
              valueFormatter={(v) => formatTokens(v)}
              showLegend={false}
              layout="horizontal"
            />
          )}
        </ChartCard>
      </div>

      {topModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Models</CardTitle>
            <CardDescription>Most used models by token count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topModels.map((model, idx) => {
                const tokens = parseTokenString(model.total_tokens);
                const maxTokens = parseTokenString(topModels[0].total_tokens);
                const percentage = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;

                return (
                  <div key={`${model.model}-${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{model.model}</span>
                      <span className="text-muted-foreground">{formatTokens(model.total_tokens)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-500"
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
