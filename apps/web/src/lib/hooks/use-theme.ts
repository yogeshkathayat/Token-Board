/**
 * Theme Hook
 *
 * Re-exports useTheme from next-themes with additional utilities.
 * Provides theme state and methods for theme switching.
 */

export { useTheme } from 'next-themes';

/**
 * Available theme options
 */
export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

/**
 * Get the next theme in the cycle
 * @param currentTheme - The current theme
 * @returns The next theme in the cycle: light -> dark -> system -> light
 */
export function getNextTheme(currentTheme: string | undefined): Theme {
  switch (currentTheme) {
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    case 'system':
    default:
      return 'light';
  }
}

/**
 * Get the display name for a theme
 * @param theme - The theme identifier
 * @returns Human-readable theme name
 */
export function getThemeDisplayName(theme: string | undefined): string {
  switch (theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    default:
      return 'System';
  }
}
