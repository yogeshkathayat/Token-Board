'use client';

import * as React from 'react';
import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
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

export interface BarChartProps {
  data: Array<Record<string, unknown>>;
  categories: string[];
  index: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showGridLines?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  layout?: 'vertical' | 'horizontal';
  height?: number;
  className?: string;
  stacked?: boolean;
  barRadius?: number;
  barGap?: number;
}

export function BarChart({
  data,
  categories,
  index,
  colors = defaultColors,
  valueFormatter = (value) => value.toLocaleString(),
  showLegend = true,
  showGridLines = true,
  showXAxis = true,
  showYAxis = true,
  layout = 'horizontal',
  height = 350,
  className,
  stacked = false,
  barRadius = 4,
  barGap = 4,
}: BarChartProps) {
  const [activeCategories, setActiveCategories] = React.useState<Set<string>>(new Set(categories));

  const handleLegendClick = React.useCallback((dataKey: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
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

  const isHorizontal = layout === 'horizontal';

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={isHorizontal ? 'horizontal' : 'vertical'}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barGap={barGap}
        >
          {showGridLines && (
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              horizontal={isHorizontal}
              vertical={!isHorizontal}
            />
          )}
          {isHorizontal ? (
            <>
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
            </>
          ) : (
            <>
              {showXAxis && (
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                  tickFormatter={valueFormatter}
                />
              )}
              {showYAxis && (
                <YAxis
                  dataKey={index}
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                  width={80}
                />
              )}
            </>
          )}
          <Tooltip
            content={<RechartsTooltipContent valueFormatter={valueFormatter} />}
            cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
          />
          {showLegend && categories.length > 1 && (
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
              <Bar
                key={category}
                dataKey={category}
                fill={color}
                fillOpacity={isActive ? 1 : 0.2}
                radius={[barRadius, barRadius, 0, 0]}
                stackId={stacked ? 'stack' : undefined}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
