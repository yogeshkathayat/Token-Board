/**
 * Utility Hooks
 *
 * A collection of reusable React hooks for common functionality.
 * All hooks are SSR-safe and properly clean up their effects.
 */

export { useDebounce } from './use-debounce';
export { useLocalStorage } from './use-local-storage';
export { useMediaQuery } from './use-media-query';
export { useCopyToClipboard } from './use-copy-to-clipboard';
export { useClickOutside } from './use-click-outside';
export { useKeyboardShortcut } from './use-keyboard-shortcut';
export { useTheme, themes, getNextTheme, getThemeDisplayName, type Theme } from './use-theme';
export { useExport, type UseExportOptions, type UseExportReturn, type ExportFormat } from './use-export';
export { useTableState, type UseTableStateOptions, type UseTableStateReturn, type TableState } from './use-table-state';
export { useNavigationGuard } from './use-navigation-guard';
export { useUrlParams, type UseUrlParamsOptions, type UseUrlParamsReturn } from './use-url-params';
export { useConfirm, type ConfirmOptions, type UseConfirmReturn } from './use-confirm';
export { useTilt, type UseTiltOptions } from './use-tilt';
export { useCursorGlow, type UseCursorGlowOptions } from './use-cursor-glow';
