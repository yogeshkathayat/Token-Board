import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  loading?: boolean;
  className?: string;
}

function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function TrendIndicator({ value, direction }: { value: number; direction: 'up' | 'down' | 'neutral' }) {
  const trendConfig = {
    up: {
      icon: ArrowUp,
      className: 'text-green-600',
      prefix: '+',
    },
    down: {
      icon: ArrowDown,
      className: 'text-red-600',
      prefix: '',
    },
    neutral: {
      icon: Minus,
      className: 'text-muted-foreground',
      prefix: '',
    },
  };

  const config = trendConfig[direction];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs', config.className)}>
      <Icon className="h-3 w-3" />
      {config.prefix}
      {Math.abs(value)}%
    </span>
  );
}

function KPICard({ title, value, description, icon: Icon, trend, loading = false, className }: KPICardProps) {
  if (loading) {
    return <KPICardSkeleton />;
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-muted-foreground">
            {trend && (
              <>
                <TrendIndicator value={trend.value} direction={trend.direction} />
                {description && ' '}
              </>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { KPICard, KPICardSkeleton, type KPICardProps };
