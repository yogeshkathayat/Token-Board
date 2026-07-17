'use client';

import * as React from 'react';
import {
  Area,
  CartesianGrid,
  Legend,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';

import { RechartsLegendContent } from './chart-legend';
import { RechartsTooltipContent } from './chart-tooltip';

const defaultColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

export interface AreaChartProps {
  data: Array<Record<string, unknown>>;
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGridLines?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  height?: number;
  className?: string;
  curveType?: 'linear' | 'monotone' | 'step';
  stacked?: boolean;
  fillOpacity?: number;
}

export function AreaChart({
  data,
  categories,
  index,
  colors = defaultColors,
  valueFormatter = (value) => value.toLocaleString(),
  showLegend = true,
  showGridLines = true,
  showXAxis = true,
  showYAxis = true,
  height = 350,
  className,
  curveType = 'monotone',
  stacked = false,
  fillOpacity = 0.3,
}: AreaChartProps) {
  const [activeCategories, setActiveCategories] = React.useState<Set<string>>(new Set(categories));

  const handleLegendClick = React.useCallback((dataKey: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        // Don't allow deselecting the last item
        if (next.size > 1) {
          next.delete(dataKey);
        }
      } else {
        next.add(dataKey);
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

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGridLines && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />}
          {showXAxis && (
            <XAxis
              dataKey={index}
              tickLine={false}
              axisLine={false}
              className="text-xs fill-muted-foreground"
              dy={10}
            />
          )}
          {showYAxis && (
            <YAxis
              tickLine={false}
              axisLine={false}
              className="text-xs fill-muted-foreground"
              tickFormatter={valueFormatter}
              width={60}
            />
          )}
          <Tooltip
            content={<RechartsTooltipContent valueFormatter={valueFormatter} />}
            cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
          />
          {showLegend && (
            <Legend
              content={<RechartsLegendContent onItemClick={handleLegendClick} activeDataKeys={activeCategories} />}
              verticalAlign="top"
              wrapperStyle={{ paddingBottom: '20px' }}
            />
          )}
          {categories.map((category, i) => {
            const color = colors[i % colors.length];
            const isActive = activeCategories.has(category);

            return (
              <Area
                key={category}
                type={curveType}
                dataKey={category}
                stroke={color}
                fill={color}
                fillOpacity={isActive ? fillOpacity : 0}
                strokeWidth={2}
                strokeOpacity={isActive ? 1 : 0}
                stackId={stacked ? 'stack' : undefined}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: color,
                  stroke: 'var(--color-background)',
                  strokeWidth: 2,
                }}
              />
            );
          })}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
