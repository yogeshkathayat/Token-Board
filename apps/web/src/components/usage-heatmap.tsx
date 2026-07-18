'use client';

import { format, getDay, startOfWeek, differenceInDays, addDays } from 'date-fns';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface HeatmapDay {
  day: string;
  total_tokens: string;
}

interface UsageHeatmapProps {
  days: HeatmapDay[];
}

function formatTokenCount(tokens: string): string {
  const num = Number(tokens);
  if (isNaN(num)) return '0';
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

function getColorIntensity(tokens: number, maxTokens: number): number {
  if (tokens === 0) return 0;
  if (maxTokens === 0) return 0;
  const ratio = tokens / maxTokens;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function UsageHeatmap({ days }: UsageHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; tokens: string } | null>(null);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No activity data available yet
      </div>
    );
  }

  const maxTokens = Math.max(...days.map((d) => Number(d.total_tokens) || 0));

  const oldestDate = new Date(days[0].day);
  const newestDate = new Date(days[days.length - 1].day);
  const startDate = startOfWeek(oldestDate, { weekStartsOn: 0 });

  const dataMap = new Map(days.map((d) => [d.day, d.total_tokens]));

  const totalDays = differenceInDays(newestDate, startDate) + 1;
  const weeks = Math.ceil(totalDays / 7);

  const grid: Array<Array<{ date: Date; tokens: string; isEmpty: boolean }>> = [];

  for (let week = 0; week < weeks; week++) {
    const weekData: Array<{ date: Date; tokens: string; isEmpty: boolean }> = [];
    for (let day = 0; day < 7; day++) {
      const date = addDays(startDate, week * 7 + day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const tokens = dataMap.get(dateStr) || '0';
      const isEmpty = date < oldestDate || date > newestDate;
      weekData.push({ date, tokens, isEmpty });
    }
    grid.push(weekData);
  }

  const monthLabels: Array<{ month: string; weekIndex: number }> = [];
  let lastMonth = -1;
  grid.forEach((weekData, weekIndex) => {
    const firstDayOfWeek = weekData[0].date;
    const month = firstDayOfWeek.getMonth();
    if (month !== lastMonth && weekIndex > 0) {
      monthLabels.push({ month: MONTH_LABELS[month], weekIndex });
      lastMonth = month;
    }
  });

  if (grid.length > 0 && monthLabels.length === 0) {
    monthLabels.push({ month: MONTH_LABELS[grid[0][0].date.getMonth()], weekIndex: 0 });
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-xs text-muted-foreground pr-2 pt-6">
          {[1, 3, 5].map((day) => (
            <div key={day} className="h-3 flex items-center">
              {WEEKDAY_LABELS[day]}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="relative">
            <div className="flex gap-0.5 text-xs text-muted-foreground pb-2 h-6">
              {monthLabels.map(({ month, weekIndex }) => (
                <div
                  key={`${month}-${weekIndex}`}
                  className="absolute"
                  style={{ left: `${weekIndex * 14 + weekIndex * 2}px` }}
                >
                  {month}
                </div>
              ))}
            </div>

            <div className="flex gap-0.5">
              {grid.map((weekData, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {weekData.map((dayData, dayIndex) => {
                    const tokens = Number(dayData.tokens) || 0;
                    const intensity = getColorIntensity(tokens, maxTokens);
                    const dateStr = format(dayData.date, 'yyyy-MM-dd');
                    const displayDate = format(dayData.date, 'MMM d, yyyy');

                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={cn(
                          'w-3 h-3 rounded-sm transition-all duration-150',
                          dayData.isEmpty
                            ? 'bg-transparent'
                            : intensity === 0
                              ? 'bg-muted/40 hover:bg-muted/60 dark:bg-muted/20 dark:hover:bg-muted/40'
                              : intensity === 1
                                ? 'bg-emerald-200 hover:bg-emerald-300 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/60'
                                : intensity === 2
                                  ? 'bg-emerald-400 hover:bg-emerald-500 dark:bg-emerald-700/60 dark:hover:bg-emerald-600/80'
                                  : intensity === 3
                                    ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500/80 dark:hover:bg-emerald-400'
                                    : 'bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-400 dark:hover:bg-emerald-300',
                          !dayData.isEmpty && 'cursor-pointer border border-transparent hover:border-foreground/20',
                        )}
                        onMouseEnter={() =>
                          !dayData.isEmpty && setHoveredDay({ date: displayDate, tokens: dayData.tokens })
                        }
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-muted/40 dark:bg-muted/20" />
              <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
              <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700/60" />
              <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500/80" />
              <div className="w-3 h-3 rounded-sm bg-emerald-700 dark:bg-emerald-400" />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>

      {hoveredDay && (
        <div className="absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground border rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="font-medium">{hoveredDay.date}</div>
          <div className="text-muted-foreground">{formatTokenCount(hoveredDay.tokens)} tokens</div>
        </div>
      )}
    </div>
  );
}
