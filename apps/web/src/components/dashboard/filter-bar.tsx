'use client';

import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/lib/hooks';
import { cn } from '@/lib/utils';

import { type ViewMode, ViewModeToggle } from './view-mode-toggle';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface Filter {
  key: string;
  label: string;
  options: FilterOption[];
  value?: string;
  onChange?: (value: string) => void;
}

interface FilterBarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  filters?: Filter[];

  // View toggle
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewToggle?: boolean;
  viewModeOptions?: ViewMode[];

  // Actions
  actions?: React.ReactNode;

  // Clear all
  showClearAll?: boolean;
  onClearAll?: () => void;

  className?: string;
}

function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  viewMode,
  onViewModeChange,
  showViewToggle = false,
  viewModeOptions = ['grid', 'table'],
  actions,
  showClearAll = true,
  onClearAll,
  className,
}: FilterBarProps) {
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue);
  const debouncedSearchValue = useDebounce(localSearchValue, 300);

  // Sync debounced value with parent
  React.useEffect(() => {
    if (onSearchChange && debouncedSearchValue !== searchValue) {
      onSearchChange(debouncedSearchValue);
    }
  }, [debouncedSearchValue, onSearchChange, searchValue]);

  // Sync external search value changes
  React.useEffect(() => {
    if (searchValue !== localSearchValue) {
      setLocalSearchValue(searchValue);
    }
    // Only update when external value changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  // Count active filters (exclude "__all__" as it's the default/unfiltered state)
  const activeFiltersCount = filters.filter((f) => f.value && f.value !== '' && f.value !== '__all__').length;
  const hasActiveFilters = activeFiltersCount > 0 || localSearchValue !== '';

  const handleClearAll = () => {
    setLocalSearchValue('');
    onClearAll?.();
  };

  const handleSearchClear = () => {
    setLocalSearchValue('');
    onSearchChange?.('');
  };

  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {/* Search input */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            className="pl-9 pr-9"
          />
          {localSearchValue && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Filter dropdowns */}
      {filters.map((filter) => (
        <Select key={filter.key} value={filter.value || ''} onValueChange={(value) => filter.onChange?.(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All {filter.label}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
                {option.count !== undefined && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {option.count}
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Clear all filters button */}
      {showClearAll && hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Spacer to push view toggle and actions to the right */}
      <div className="flex-1 hidden sm:block" />

      {/* View mode toggle */}
      {showViewToggle && viewMode && onViewModeChange && (
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} options={viewModeOptions} />
      )}

      {/* Custom actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { FilterBar, type FilterBarProps, type FilterOption, type Filter };
