'use client';

import { Table } from '@tanstack/react-table';
import { Check, ChevronDown, X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { DataTableViewOptions } from './data-table-view-options';

// ============================================================================
// Inline Filter Types
// ============================================================================

export interface InlineFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface InlineFilterConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  options: InlineFilterOption[];
  value: string;
  onChange: (value: string) => void;
}

// ============================================================================
// Inline Filter Pill
// ============================================================================

function InlineFilterPill({ filter }: { filter: InlineFilterConfig }) {
  const isActive = filter.value !== '' && filter.value !== undefined;
  const activeOption = filter.options.find((o) => o.value === filter.value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 rounded-full border-dashed text-xs font-medium',
            isActive && 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20',
          )}
        >
          {filter.icon && <span className="shrink-0">{filter.icon}</span>}
          {filter.label}
          {isActive && activeOption && (
            <>
              <span className="mx-0.5 h-4 w-px bg-current opacity-20" />
              <span className="max-w-[80px] truncate">{activeOption.label}</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        <DropdownMenuItem onClick={() => filter.onChange('')}>
          <div className="flex w-full items-center justify-between">
            <span>All</span>
            {!isActive && <Check className="h-4 w-4 text-primary" />}
          </div>
        </DropdownMenuItem>
        {filter.options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => filter.onChange(option.value)}>
            <div className="flex w-full items-center justify-between">
              <span>{option.label}</span>
              <div className="flex items-center gap-1.5">
                {option.count !== undefined && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {option.count}
                  </Badge>
                )}
                {filter.value === option.value && <Check className="h-4 w-4 text-primary" />}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Data Table Toolbar
// ============================================================================

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  showColumnVisibility?: boolean;
  onColumnOrderChange?: (columnOrder: string[]) => void;
  inlineFilters?: InlineFilterConfig[];
  onClearFilters?: () => void;
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder = 'Search...',
  showColumnVisibility = true,
  onColumnOrderChange,
  inlineFilters,
  onClearFilters,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const activeInlineFilterCount = inlineFilters?.filter((f) => f.value !== '' && f.value !== undefined).length ?? 0;
  const hasActiveInlineFilters = activeInlineFilterCount > 0;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {inlineFilters?.map((filter) => <InlineFilterPill key={filter.id} filter={filter} />)}
        {(isFiltered || hasActiveInlineFilters) && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              onClearFilters?.();
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      {showColumnVisibility && <DataTableViewOptions table={table} onColumnOrderChange={onColumnOrderChange} />}
    </div>
  );
}
