'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataTableBulkActionsProps {
  selectedCount: number;
  onClearSelection?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function DataTableBulkActions({
  selectedCount,
  onClearSelection,
  children,
  className,
}: DataTableBulkActionsProps) {
  const isVisible = selectedCount > 0;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-4 right-4 z-50 translate-x-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-in-out',
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border bg-background/95 px-3 py-2.5 sm:px-4 sm:py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground">
            {selectedCount}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {selectedCount === 1 ? 'row' : 'rows'} selected
          </span>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border sm:mx-2 sm:block" />

        <div className="flex items-center gap-2">{children}</div>

        {onClearSelection && (
          <>
            <div className="mx-1 hidden h-6 w-px bg-border sm:mx-2 sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
