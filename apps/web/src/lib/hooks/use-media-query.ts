'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to CSS media query changes.
 * Returns true if the media query matches, false otherwise.
 * SSR-safe: returns false during server-side rendering.
 *
 * @param query - CSS media query string
 * @returns Boolean indicating if the media query matches
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)')
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
 * const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Return false during SSR
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Set initial value (in case it changed between render and effect)
    setMatches(mediaQueryList.matches);

    // Modern event listener
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Use addEventListener for modern browsers
    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
