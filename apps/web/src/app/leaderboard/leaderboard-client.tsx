'use client';

import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Award, Medal, Trophy } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

import { SourceIcon } from '@/components/source-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Period = 'week' | 'month' | 'total';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
  is_me: boolean;
  claude_tokens: string;
  codex_tokens: string;
  cursor_tokens: string;
  kiro_tokens: string;
  gemini_tokens: string;
  opencode_tokens: string;
  other_tokens: string;
  total_tokens: string;
  estimated_cost_usd: string;
}

interface LeaderboardData {
  period: Period;
  from_day: string;
  to_day: string;
  generated_at: string;
  entries: LeaderboardEntry[];
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

function formatCost(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  }
  if (rank === 2) {
    return <Medal className="h-5 w-5 text-gray-400" />;
  }
  if (rank === 3) {
    return <Award className="h-5 w-5 text-amber-600" />;
  }
  return <span className="text-sm font-medium text-muted-foreground">#{rank}</span>;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  total: 'All Time',
};

export function LeaderboardClient() {
  const [period, setPeriod] = useState<Period>('week');
  const { data, error, isLoading } = useSWR<LeaderboardData>(
    `/api/leaderboard?period=${period}`,
    fetcher,
    {
      refreshInterval: 60000,
    },
  );

  const columns: ColumnDef<LeaderboardEntry>[] = [
    {
      accessorKey: 'rank',
      header: 'Rank',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <RankBadge rank={row.original.rank} />
        </div>
      ),
    },
    {
      accessorKey: 'display_name',
      header: 'Developer',
      size: 200,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-background ring-1 ring-border">
              {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name} />}
              <AvatarFallback className="text-xs">{getInitials(entry.display_name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{entry.display_name}</span>
            {entry.is_me && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                You
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'claude_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="claude" className="text-muted-foreground" />
          <span>Claude</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.claude_tokens)}</div>,
    },
    {
      accessorKey: 'cursor_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="cursor" className="text-muted-foreground" />
          <span>Cursor</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.cursor_tokens)}</div>,
    },
    {
      accessorKey: 'codex_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="codex" className="text-muted-foreground" />
          <span>Codex</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.codex_tokens)}</div>,
    },
    {
      accessorKey: 'gemini_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="gemini" className="text-muted-foreground" />
          <span>Gemini</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.gemini_tokens)}</div>,
    },
    {
      accessorKey: 'kiro_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="kiro" className="text-muted-foreground" />
          <span>Kiro</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.kiro_tokens)}</div>,
    },
    {
      accessorKey: 'opencode_tokens',
      header: () => (
        <div className="flex items-center justify-end gap-1.5">
          <SourceIcon source="opencode" className="text-muted-foreground" />
          <span>OpenCode</span>
        </div>
      ),
      size: 100,
      cell: ({ row }) => <div className="text-right font-mono text-sm">{formatTokens(row.original.opencode_tokens)}</div>,
    },
    {
      accessorKey: 'total_tokens',
      header: () => <div className="text-right">Total</div>,
      size: 120,
      cell: ({ row }) => (
        <div className="text-right font-bold text-base font-mono bg-primary/5 px-2 py-1 rounded">
          {formatTokens(row.original.total_tokens)}
        </div>
      ),
    },
    {
      accessorKey: 'estimated_cost_usd',
      header: () => <div className="text-right">Est. Cost</div>,
      size: 100,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground font-mono text-sm">
          {formatCost(row.original.estimated_cost_usd)}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          Failed to load leaderboard. Please try again.
        </CardContent>
      </Card>
    );
  }

  const updatedAgo = data?.generated_at
    ? formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Company-wide token usage rankings
            {updatedAgo && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded-full">
                Updated {updatedAgo}
              </span>
            )}
          </p>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="week" className="data-[state=active]:bg-background">
              Last 7 Days
            </TabsTrigger>
            <TabsTrigger value="month" className="data-[state=active]:bg-background">
              Last 30 Days
            </TabsTrigger>
            <TabsTrigger value="total" className="data-[state=active]:bg-background">
              All Time
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
          <CardTitle className="flex items-center gap-2">
            {period === 'week' && '📅'}
            {period === 'month' && '📆'}
            {period === 'total' && '🏆'}
            {PERIOD_LABELS[period]}
          </CardTitle>
          <CardDescription>
            {data?.from_day && data?.to_day
              ? `${new Date(data.from_day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(data.to_day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : 'Loading period...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.entries || []}
            isLoading={isLoading}
            pageSize={20}
            pageSizeOptions={[10, 20, 50, 100]}
            columnVisibility={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
