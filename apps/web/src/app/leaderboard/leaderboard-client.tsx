'use client';

import { ColumnDef } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Award, Medal, Trophy } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

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
  week: 'This Week',
  month: 'This Month',
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
            <Avatar className="h-8 w-8">
              {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.display_name} />}
              <AvatarFallback>{getInitials(entry.display_name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{entry.display_name}</span>
            {entry.is_me && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">You</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'claude_tokens',
      header: 'Claude',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.claude_tokens)}</div>,
    },
    {
      accessorKey: 'cursor_tokens',
      header: 'Cursor',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.cursor_tokens)}</div>,
    },
    {
      accessorKey: 'codex_tokens',
      header: 'Codex',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.codex_tokens)}</div>,
    },
    {
      accessorKey: 'gemini_tokens',
      header: 'Gemini',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.gemini_tokens)}</div>,
    },
    {
      accessorKey: 'kiro_tokens',
      header: 'Kiro',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.kiro_tokens)}</div>,
    },
    {
      accessorKey: 'opencode_tokens',
      header: 'OpenCode',
      size: 100,
      cell: ({ row }) => <div className="text-right">{formatTokens(row.original.opencode_tokens)}</div>,
    },
    {
      accessorKey: 'total_tokens',
      header: 'Total',
      size: 120,
      cell: ({ row }) => <div className="text-right font-semibold">{formatTokens(row.original.total_tokens)}</div>,
    },
    {
      accessorKey: 'estimated_cost_usd',
      header: 'Est. Cost',
      size: 100,
      cell: ({ row }) => <div className="text-right text-muted-foreground">{formatCost(row.original.estimated_cost_usd)}</div>,
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Company-wide token usage rankings
            {updatedAgo && <span className="ml-2 text-xs">Updated {updatedAgo}</span>}
          </p>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="total">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{PERIOD_LABELS[period]}</CardTitle>
          <CardDescription>
            {data?.from_day && data?.to_day
              ? `${new Date(data.from_day).toLocaleDateString()} - ${new Date(data.to_day).toLocaleDateString()}`
              : 'Loading period...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
