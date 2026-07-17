import * as React from 'react';

import { cn } from '@/lib/utils';

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  return <div className={cn('grid gap-4', columnClasses[columns], className)}>{children}</div>;
}

export { StatsGrid, type StatsGridProps };
