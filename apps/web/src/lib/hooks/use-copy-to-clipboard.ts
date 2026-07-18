'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy text to clipboard with a success state that auto-resets.
 * Returns a tuple of [copied, copyFn] where copied indicates success.
 *
 * @returns A tuple of [copied: boolean, copy: (text: string) => Promise<void>]
 *
 * @example
 * ```tsx
 * const [copied, copyToClipboard] = useCopyToClipboard()
 *
 * return (
 *   <button onClick={() => copyToClipboard('Hello World!')}>
 *     {copied ? 'Copied!' : 'Copy'}
 *   </button>
 * )
 * ```
 */
export function useCopyToClipboard(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(async (text: string): Promise<void> => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Check if clipboard API is available
    if (!navigator?.clipboard) {
      console.warn('Clipboard API not available');
      setCopied(false);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      // Reset copied state after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      setCopied(false);
    }
  }, []);

  return [copied, copy];
}
