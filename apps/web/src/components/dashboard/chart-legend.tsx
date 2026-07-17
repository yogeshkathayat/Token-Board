'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface LegendItem {
  name: string;
  color: string;
  value?: number;
}

export interface ChartLegendProps {
  items: LegendItem[];
  layout?: 'horizontal' | 'vertical';
  onItemClick?: (item: LegendItem, index: number) => void;
  activeItems?: Set<string>;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function ChartLegend({
  items,
  layout = 'horizontal',
  onItemClick,
  activeItems,
  valueFormatter,
  className,
}: ChartLegendProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const isInteractive = !!onItemClick;

  return (
    <div
      className={cn('flex gap-4 text-sm', layout === 'vertical' ? 'flex-col' : 'flex-wrap justify-center', className)}
    >
      {items.map((item, index) => {
        const isActive = activeItems ? activeItems.has(item.name) : true;

        return (
          <button
            key={item.name}
            type="button"
            onClick={() => onItemClick?.(item, index)}
            disabled={!isInteractive}
            className={cn(
              'flex items-center gap-2 transition-opacity',
              isInteractive && 'cursor-pointer hover:opacity-80',
              !isInteractive && 'cursor-default',
              !isActive && 'opacity-40',
            )}
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            {item.value !== undefined && valueFormatter && (
              <span className="font-medium text-foreground">{valueFormatter(item.value)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Recharts-compatible legend props adapter
export interface RechartsLegendPayload {
  value: string;
  color?: string;
  dataKey?: string;
  payload?: {
    fill?: string;
    stroke?: string;
  };
}

export interface RechartsLegendContentProps {
  payload?: RechartsLegendPayload[];
  layout?: 'horizontal' | 'vertical';
  onItemClick?: (dataKey: string) => void;
  activeDataKeys?: Set<string>;
  className?: string;
}

export function RechartsLegendContent({
  payload,
  layout = 'horizontal',
  onItemClick,
  activeDataKeys,
  className,
}: RechartsLegendContentProps) {
  if (!payload || payload.length === 0) {
    return null;
  }

  const items: LegendItem[] = payload.map((entry) => ({
    name: entry.value,
    color: entry.color ?? entry.payload?.fill ?? entry.payload?.stroke ?? '#8884d8',
  }));

  const handleItemClick = onItemClick
    ? (item: LegendItem) => {
        const entry = payload.find((p) => p.value === item.name);
        if (entry?.dataKey) {
          onItemClick(entry.dataKey);
        }
      }
    : undefined;

  return (
    <ChartLegend
      items={items}
      layout={layout}
      onItemClick={handleItemClick}
      activeItems={activeDataKeys}
      className={className}
    />
  );
}
