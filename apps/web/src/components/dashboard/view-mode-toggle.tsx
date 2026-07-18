'use client';

import { LayoutGrid, List, Table2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'table' | 'list';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  options?: ViewMode[];
  showLabels?: boolean;
  className?: string;
}

const viewModeConfig: Record<
  ViewMode,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  grid: {
    icon: LayoutGrid,
    label: 'Grid view',
  },
  table: {
    icon: Table2,
    label: 'Table view',
  },
  list: {
    icon: List,
    label: 'List view',
  },
};

function ViewModeToggle({
  value,
  onChange,
  options = ['grid', 'table'],
  showLabels = false,
  className,
}: ViewModeToggleProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('inline-flex items-center rounded-md border bg-background p-1', className)}
        role="radiogroup"
        aria-label="View mode"
      >
        {options.map((mode) => {
          const config = viewModeConfig[mode];
          const Icon = config.icon;
          const isActive = value === mode;

          const button = (
            <Button
              key={mode}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 gap-2',
                showLabels ? 'px-3' : 'w-8 p-0',
                !isActive && 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onChange(mode)}
              role="radio"
              aria-checked={isActive}
              aria-label={config.label}
            >
              <Icon className="h-4 w-4" />
              {showLabels && <span className="text-xs font-medium">{config.label}</span>}
            </Button>
          );

          if (showLabels) {
            return button;
          }

          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {config.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export { ViewModeToggle, type ViewModeToggleProps, type ViewMode };
