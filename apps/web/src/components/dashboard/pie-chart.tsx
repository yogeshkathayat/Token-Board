'use client';

import * as React from 'react';
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '@/lib/utils';

import { ChartLegend, type LegendItem } from './chart-legend';
import { RechartsTooltipContent } from './chart-tooltip';

const defaultColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

export interface PieChartDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartDataItem[];
  valueFormatter?: (value: number) => string;
  showLabel?: boolean;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
  className?: string;
  paddingAngle?: number;
}

export function PieChart({
  data,
  valueFormatter = (value) => value.toLocaleString(),
  showLabel = false,
  showLegend = true,
  innerRadius = 0,
  outerRadius,
  height = 350,
  className,
  paddingAngle = 2,
}: PieChartProps) {
  const [activeNames, setActiveNames] = React.useState<Set<string>>(new Set(data.map((d) => d.name)));

  const handleLegendClick = React.useCallback((item: LegendItem) => {
    setActiveNames((prev) => {
      const next = new Set(prev);
      if (next.has(item.name)) {
        if (next.size > 1) {
          next.delete(item.name);
        }
      } else {
        next.add(item.name);
      }
      return next;
    });
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', className)} style={{ height }}>
        No data available
      </div>
    );
  }

  // Filter data based on active items
  const filteredData = data.filter((d) => activeNames.has(d.name));

  // Prepare colors for each data item
  const dataWithColors = filteredData.map((item, index) => ({
    ...item,
    color: item.color ?? defaultColors[index % defaultColors.length],
  }));

  // Calculate total for percentage labels
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);

  // Legend items
  const legendItems: LegendItem[] = data.map((item, index) => ({
    name: item.name,
    color: item.color ?? defaultColors[index % defaultColors.length],
    value: item.value,
  }));

  // Calculate chart size based on height
  const chartOuterRadius = outerRadius ?? Math.min(height * 0.35, 120);

  // Reserve space for legend when shown
  const legendHeight = showLegend ? 48 : 0;
  const chartHeight = height - legendHeight;

  return (
    <div className={cn('w-full flex flex-col', className)} style={{ height }}>
      <div className="flex-1 min-h-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie
              data={dataWithColors}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={chartOuterRadius}
              paddingAngle={paddingAngle}
              dataKey="value"
              nameKey="name"
              label={
                showLabel
                  ? ({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  : undefined
              }
              labelLine={showLabel}
            >
              {dataWithColors.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="var(--color-background)"
                  strokeWidth={2}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) {
                  return null;
                }
                const item = payload[0];
                const percentage = total > 0 ? ((item.value as number) / total) * 100 : 0;
                return (
                  <RechartsTooltipContent
                    active={active}
                    payload={[
                      {
                        name: item.name as string,
                        value: item.value as number,
                        color: item.payload?.color,
                      },
                    ]}
                    label={`${percentage.toFixed(1)}% of total`}
                    valueFormatter={valueFormatter}
                  />
                );
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      {showLegend && (
        <ChartLegend
          items={legendItems}
          layout="horizontal"
          onItemClick={handleLegendClick}
          activeItems={activeNames}
          valueFormatter={valueFormatter}
          className="flex-shrink-0 pt-2"
        />
      )}
    </div>
  );
}
