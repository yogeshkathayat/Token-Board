'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (value) => value.toLocaleString(),
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md', className)}>
      {label && <p className="mb-1 text-sm font-medium text-foreground">{label}</p>}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}:</span>
            <span className="font-medium">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Custom tooltip wrapper for Recharts
export interface RechartsTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string) => string;
  className?: string;
}

export function RechartsTooltipContent({
  active,
  payload,
  label,
  valueFormatter = (value) => value.toLocaleString(),
  labelFormatter,
  className,
}: RechartsTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const formattedLabel = labelFormatter ? labelFormatter(label ?? '') : label;

  const formattedPayload = payload.map((item) => ({
    name: item.name ?? String(item.dataKey ?? ''),
    value: typeof item.value === 'number' ? item.value : 0,
    color: item.color,
    dataKey: item.dataKey,
  }));

  return (
    <ChartTooltip
      active={active}
      payload={formattedPayload}
      label={formattedLabel}
      valueFormatter={valueFormatter}
      className={className}
    />
  );
}
