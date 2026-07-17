'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Persist state to localStorage with automatic JSON serialization.
 * Handles SSR safely and supports functional updates like useState.
 *
 * @param key - The localStorage key
 * @param initialValue - Initial value if no stored value exists
 * @returns A tuple of [storedValue, setValue] similar to useState
 *
 * @example
 * ```tsx
 * const [theme, setTheme] = useLocalStorage('theme', 'light')
 *
 * // Direct update
 * setTheme('dark')
 *
 * // Functional update
 * setTheme(prev => prev === 'light' ? 'dark' : 'light')
 * ```
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state with a function to avoid reading localStorage on every render
  const [storedValue, setStoredValue] = useState<T>(() => {
    // Return initial value during SSR
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Memoized setter that handles both direct values and functional updates
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Handle functional updates
        setStoredValue((prevValue) => {
          const valueToStore = value instanceof Function ? value(prevValue) : value;

          // Save to localStorage (only in browser)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }

          return valueToStore;
        });
      } catch (error) {
        // Handle quota exceeded or other localStorage errors
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key],
  );

  // Sync with other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setStoredValue(JSON.parse(event.newValue) as T);
        } catch (error) {
          console.warn(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
}
