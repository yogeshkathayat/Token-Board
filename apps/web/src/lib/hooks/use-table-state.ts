'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Options for the useTableState hook
 */
export interface UseTableStateOptions {
  /** Unique key to identify this table's state in localStorage */
  key: string;
  /** Default column visibility settings */
  defaultColumnVisibility?: Record<string, boolean>;
  /** Default column order */
  defaultColumnOrder?: string[];
  /** Default column sizing */
  defaultColumnSizing?: Record<string, number>;
  /** Debounce delay in milliseconds for saving to localStorage */
  debounceMs?: number;
}

/**
 * Persisted table state structure
 */
export interface TableState {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
}

/**
 * Return type for useTableState hook
 */
export interface UseTableStateReturn {
  /** Current column visibility state */
  columnVisibility: Record<string, boolean>;
  /** Update column visibility */
  setColumnVisibility: (
    value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  /** Current column order */
  columnOrder: string[];
  /** Update column order */
  setColumnOrder: (value: string[] | ((prev: string[]) => string[])) => void;
  /** Current column sizing */
  columnSizing: Record<string, number>;
  /** Update column sizing */
  setColumnSizing: (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  /** Reset table state to defaults */
  resetTableState: () => void;
  /** Whether state has been loaded from storage */
  isLoaded: boolean;
}

const STORAGE_PREFIX = 'table-state:';

/**
 * Persist table state to localStorage with debounced saves.
 * Saves column visibility, column order, and column sizing.
 * Restores state on mount and syncs across browser tabs.
 *
 * @param options - Configuration options
 * @returns Table state and setter functions
 *
 * @example
 * ```tsx
 * const {
 *   columnVisibility,
 *   setColumnVisibility,
 *   columnOrder,
 *   setColumnOrder,
 *   columnSizing,
 *   setColumnSizing,
 *   resetTableState,
 *   isLoaded
 * } = useTableState({
 *   key: 'users-table',
 *   defaultColumnVisibility: { email: true, phone: false },
 *   defaultColumnOrder: ['name', 'email', 'phone'],
 * })
 *
 * // Use with TanStack Table
 * const table = useReactTable({
 *   state: { columnVisibility, columnOrder, columnSizing },
 *   onColumnVisibilityChange: setColumnVisibility,
 *   onColumnOrderChange: setColumnOrder,
 *   onColumnSizingChange: setColumnSizing,
 * })
 * ```
 */
export function useTableState(options: UseTableStateOptions): UseTableStateReturn {
  const {
    key,
    defaultColumnVisibility = {},
    defaultColumnOrder = [],
    defaultColumnSizing = {},
    debounceMs = 500,
  } = options;

  const storageKey = `${STORAGE_PREFIX}${key}`;

  // Track if initial load from storage is complete
  const [isLoaded, setIsLoaded] = useState(false);

  // Column visibility state
  const [columnVisibility, setColumnVisibilityState] = useState<Record<string, boolean>>(defaultColumnVisibility);

  // Column order state
  const [columnOrder, setColumnOrderState] = useState<string[]>(defaultColumnOrder);

  // Column sizing state
  const [columnSizing, setColumnSizingState] = useState<Record<string, number>>(defaultColumnSizing);

  // Ref for debounce timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoaded(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<TableState>;

        if (parsed.columnVisibility) {
          setColumnVisibilityState({
            ...defaultColumnVisibility,
            ...parsed.columnVisibility,
          });
        }

        if (parsed.columnOrder && parsed.columnOrder.length > 0) {
          setColumnOrderState(parsed.columnOrder);
        }

        if (parsed.columnSizing) {
          setColumnSizingState({
            ...defaultColumnSizing,
            ...parsed.columnSizing,
          });
        }
      }
    } catch (error) {
      console.warn(`Error loading table state for key "${key}":`, error);
    }

    setIsLoaded(true);
  }, [storageKey, key, defaultColumnVisibility, defaultColumnOrder, defaultColumnSizing]);

  // Debounced save to localStorage
  const saveToStorage = useCallback(
    (state: TableState) => {
      if (typeof window === 'undefined') {
        return;
      }

      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new debounced save
      saveTimerRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
          console.warn(`Error saving table state for key "${key}":`, error);
        }
      }, debounceMs);
    },
    [storageKey, key, debounceMs],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Wrapped setters that trigger saves
  const setColumnVisibility = useCallback(
    (value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => {
      setColumnVisibilityState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        saveToStorage({
          columnVisibility: newValue,
          columnOrder,
          columnSizing,
        });
        return newValue;
      });
    },
    [saveToStorage, columnOrder, columnSizing],
  );

  const setColumnOrder = useCallback(
    (value: string[] | ((prev: string[]) => string[])) => {
      setColumnOrderState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        saveToStorage({
          columnVisibility,
          columnOrder: newValue,
          columnSizing,
        });
        return newValue;
      });
    },
    [saveToStorage, columnVisibility, columnSizing],
  );

  const setColumnSizing = useCallback(
    (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
      setColumnSizingState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        saveToStorage({
          columnVisibility,
          columnOrder,
          columnSizing: newValue,
        });
        return newValue;
      });
    },
    [saveToStorage, columnVisibility, columnOrder],
  );

  // Reset to defaults
  const resetTableState = useCallback(() => {
    setColumnVisibilityState(defaultColumnVisibility);
    setColumnOrderState(defaultColumnOrder);
    setColumnSizingState(defaultColumnSizing);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn(`Error removing table state for key "${key}":`, error);
      }
    }
  }, [defaultColumnVisibility, defaultColumnOrder, defaultColumnSizing, storageKey, key]);

  // Sync with other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue !== null) {
        try {
          const parsed = JSON.parse(event.newValue) as Partial<TableState>;

          if (parsed.columnVisibility) {
            setColumnVisibilityState(parsed.columnVisibility);
          }

          if (parsed.columnOrder) {
            setColumnOrderState(parsed.columnOrder);
          }

          if (parsed.columnSizing) {
            setColumnSizingState(parsed.columnSizing);
          }
        } catch (error) {
          console.warn(`Error parsing storage event for table state "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, key]);

  return {
    columnVisibility,
    setColumnVisibility,
    columnOrder,
    setColumnOrder,
    columnSizing,
    setColumnSizing,
    resetTableState,
    isLoaded,
  };
}
