'use client';

import { useCallback, useEffect } from 'react';

type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';

interface KeyboardShortcutOptions {
  /**
   * Whether to prevent the default browser behavior
   * @default true
   */
  preventDefault?: boolean;
}

/**
 * Listen for keyboard shortcut combinations.
 * Supports modifier keys (ctrl, alt, shift, meta) and regular keys.
 * Handles both Ctrl (Windows/Linux) and Meta/Cmd (Mac).
 *
 * @param keys - Array of keys that form the shortcut (e.g., ['ctrl', 'k'] or ['meta', 'shift', 's'])
 * @param callback - Function to execute when the shortcut is triggered
 * @param options - Optional configuration
 *
 * @example
 * ```tsx
 * // Simple shortcut: Ctrl+K or Cmd+K
 * useKeyboardShortcut(['ctrl', 'k'], () => {
 *   openSearchModal()
 * })
 *
 * // Multi-modifier shortcut: Ctrl+Shift+S or Cmd+Shift+S
 * useKeyboardShortcut(['ctrl', 'shift', 's'], () => {
 *   saveDocument()
 * })
 *
 * // Without preventing default
 * useKeyboardShortcut(['ctrl', 'c'], handleCopy, { preventDefault: false })
 * ```
 */
export function useKeyboardShortcut(keys: string[], callback: () => void, options: KeyboardShortcutOptions = {}): void {
  const { preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Normalize the keys array to lowercase
      const normalizedKeys = keys.map((key) => key.toLowerCase());

      // Separate modifier keys from regular keys
      const modifiers: ModifierKey[] = [];
      const regularKeys: string[] = [];

      normalizedKeys.forEach((key) => {
        if (['ctrl', 'alt', 'shift', 'meta'].includes(key)) {
          modifiers.push(key as ModifierKey);
        } else {
          regularKeys.push(key);
        }
      });

      // Check if all required modifiers are pressed
      const modifiersMatch = modifiers.every((modifier) => {
        switch (modifier) {
          case 'ctrl':
            return event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
          case 'alt':
            return event.altKey;
          case 'shift':
            return event.shiftKey;
          case 'meta':
            return event.metaKey || event.ctrlKey; // Support both Cmd and Ctrl
          default:
            return false;
        }
      });

      // Check if no extra modifiers are pressed (unless they're in our list)
      const noExtraModifiers =
        (modifiers.includes('ctrl') || modifiers.includes('meta') || (!event.ctrlKey && !event.metaKey)) &&
        (modifiers.includes('alt') || !event.altKey) &&
        (modifiers.includes('shift') || !event.shiftKey);

      // Check if the regular key matches
      const keyMatches = regularKeys.some((key) => event.key?.toLowerCase() === key);

      // If all conditions are met, execute the callback
      if (modifiersMatch && noExtraModifiers && keyMatches) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback();
      }
    },
    [keys, callback, preventDefault],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
