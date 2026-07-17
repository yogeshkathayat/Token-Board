'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Supported parameter value types
 */
type ParamValue = string | string[] | number | boolean | null | undefined;

/**
 * Options for useUrlParams hook
 */
export interface UseUrlParamsOptions<T extends Record<string, ParamValue>> {
  /** Default values for all parameters */
  defaultValues: T;
  /**
   * Optional mapping of state keys to URL parameter names.
   * Useful when you want shorter URL params or different naming.
   */
  paramMapping?: Partial<Record<keyof T, string>>;
  /** Debounce delay in milliseconds for URL updates */
  debounceMs?: number;
  /**
   * Whether to replace or push to browser history.
   * 'replace' is recommended for filter state to avoid polluting history.
   */
  historyMode?: 'push' | 'replace';
}

/**
 * Return type for useUrlParams hook
 */
export type UseUrlParamsReturn<T extends Record<string, ParamValue>> = [
  /** Current state synced with URL */
  T,
  /** Update state (will be reflected in URL) */
  (updates: Partial<T>) => void,
  /** Reset all params to defaults */
  () => void,
];

/**
 * Parse a URL parameter value to its typed equivalent
 */
function parseParamValue<T extends ParamValue>(value: string | string[] | null, defaultValue: T): T {
  if (value === null) {
    return defaultValue;
  }

  // Handle array type
  if (Array.isArray(defaultValue)) {
    if (Array.isArray(value)) {
      return value as T;
    }
    // Single value becomes array
    return [value] as T;
  }

  // Handle array from URL (comma-separated or multiple params)
  if (Array.isArray(value)) {
    // If default is not array but we got array, take first value
    value = value[0];
  }

  // Handle number type
  if (typeof defaultValue === 'number') {
    const parsed = Number(value);
    return (isNaN(parsed) ? defaultValue : parsed) as T;
  }

  // Handle boolean type
  if (typeof defaultValue === 'boolean') {
    return (value === 'true' || value === '1') as T;
  }

  // Handle string type (default)
  return value as T;
}

/**
 * Serialize a value for URL parameter
 */
function serializeParamValue(value: ParamValue): string | string[] | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String) : null;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : null;
  }

  return String(value);
}

/**
 * Check if a value equals its default (for determining whether to include in URL)
 */
function isDefaultValue<T extends ParamValue>(value: T, defaultValue: T): boolean {
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    return value.length === defaultValue.length && value.every((v, i) => v === defaultValue[i]);
  }

  return value === defaultValue;
}

/**
 * Sync filter/search state with URL search parameters.
 * Supports string, string[], number, and boolean types.
 * Uses debounced updates to avoid excessive URL changes.
 * Works with Next.js App Router (useSearchParams, useRouter).
 *
 * @param options - Configuration options
 * @returns Tuple of [state, updateState, resetState]
 *
 * @example
 * ```tsx
 * interface Filters {
 *   search: string
 *   status: string[]
 *   page: number
 *   showArchived: boolean
 * }
 *
 * function ProductList() {
 *   const [filters, setFilters, resetFilters] = useUrlParams<Filters>({
 *     defaultValues: {
 *       search: '',
 *       status: [],
 *       page: 1,
 *       showArchived: false,
 *     },
 *     paramMapping: {
 *       search: 'q',        // URL: ?q=...
 *       showArchived: 'archived',
 *     },
 *     debounceMs: 300,
 *   })
 *
 *   return (
 *     <div>
 *       <input
 *         value={filters.search}
 *         onChange={(e) => setFilters({ search: e.target.value, page: 1 })}
 *         placeholder="Search..."
 *       />
 *
 *       <select
 *         multiple
 *         value={filters.status}
 *         onChange={(e) => setFilters({
 *           status: Array.from(e.target.selectedOptions, o => o.value),
 *           page: 1,
 *         })}
 *       >
 *         <option value="active">Active</option>
 *         <option value="inactive">Inactive</option>
 *       </select>
 *
 *       <button onClick={() => setFilters({ page: filters.page + 1 })}>
 *         Next Page
 *       </button>
 *
 *       <button onClick={resetFilters}>Clear Filters</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useUrlParams<T extends Record<string, ParamValue>>(
  options: UseUrlParamsOptions<T>,
): UseUrlParamsReturn<T> {
  const { defaultValues, paramMapping = {}, debounceMs = 150, historyMode = 'replace' } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Ref for debounce timer
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Get URL param name for a state key
  const getUrlParamName = useCallback(
    (stateKey: keyof T): string => {
      const mapping = paramMapping as Partial<Record<keyof T, string>>;
      return mapping[stateKey] || String(stateKey);
    },
    [paramMapping],
  );

  // Parse current URL params into state
  const parseUrlToState = useCallback((): T => {
    const state = { ...defaultValues };

    for (const key of Object.keys(defaultValues) as (keyof T)[]) {
      const urlParamName = getUrlParamName(key);
      const urlValue = searchParams.getAll(urlParamName);

      if (urlValue.length > 0) {
        const singleOrArray = urlValue.length === 1 ? urlValue[0] : urlValue;
        state[key] = parseParamValue(singleOrArray, defaultValues[key]);
      }
    }

    return state;
  }, [searchParams, defaultValues, getUrlParamName]);

  // Initialize state from URL
  const [state, setState] = useState<T>(() => parseUrlToState());

  // Sync state when URL changes externally (e.g., browser back/forward)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newState = parseUrlToState();
    setState(newState);
  }, [searchParams, parseUrlToState]);

  // Update URL with current state (debounced)
  const updateUrl = useCallback(
    (newState: T) => {
      // Clear existing timer
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      updateTimerRef.current = setTimeout(() => {
        const params = new URLSearchParams();

        for (const key of Object.keys(newState) as (keyof T)[]) {
          const value = newState[key];
          const defaultValue = defaultValues[key];

          // Skip default values (keep URL clean)
          if (isDefaultValue(value, defaultValue)) {
            continue;
          }

          const urlParamName = getUrlParamName(key);
          const serialized = serializeParamValue(value);

          if (serialized !== null) {
            if (Array.isArray(serialized)) {
              // Add each array item as separate param
              for (const item of serialized) {
                params.append(urlParamName, item);
              }
            } else {
              params.set(urlParamName, serialized);
            }
          }
        }

        const queryString = params.toString();
        const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

        if (historyMode === 'replace') {
          router.replace(newUrl, { scroll: false });
        } else {
          router.push(newUrl, { scroll: false });
        }
      }, debounceMs);
    },
    [defaultValues, getUrlParamName, pathname, router, historyMode, debounceMs],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  // Update state and URL
  const setParams = useCallback(
    (updates: Partial<T>) => {
      setState((prev) => {
        const newState = { ...prev, ...updates };
        updateUrl(newState);
        return newState;
      });
    },
    [updateUrl],
  );

  // Reset to defaults
  const resetParams = useCallback(() => {
    setState(defaultValues);
    updateUrl(defaultValues);
  }, [defaultValues, updateUrl]);

  return [state, setParams, resetParams];
}
