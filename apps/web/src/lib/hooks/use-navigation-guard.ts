'use client';

import { useCallback, useEffect } from 'react';

/**
 * Default message shown in the browser's beforeunload dialog.
 * Note: Most modern browsers ignore custom messages and show a generic one.
 */
const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Prevent accidental navigation away from the page during important operations.
 * Shows the browser's native beforeunload dialog when attempting to close
 * the tab, navigate away, or refresh the page.
 *
 * Note: Modern browsers typically show a generic message regardless of the
 * custom message provided, for security reasons.
 *
 * @param enabled - Whether the navigation guard should be active
 * @param message - Custom message for the dialog (may be ignored by browser)
 *
 * @example
 * ```tsx
 * function FormPage() {
 *   const [isDirty, setIsDirty] = useState(false)
 *
 *   // Guard navigation when form has unsaved changes
 *   useNavigationGuard(isDirty, 'You have unsaved changes.')
 *
 *   return (
 *     <form onChange={() => setIsDirty(true)}>
 *       ...
 *     </form>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * function UploadPage() {
 *   const [isUploading, setIsUploading] = useState(false)
 *
 *   // Prevent navigation during file upload
 *   useNavigationGuard(isUploading, 'Upload in progress. Leaving will cancel it.')
 *
 *   const handleUpload = async () => {
 *     setIsUploading(true)
 *     try {
 *       await uploadFile()
 *     } finally {
 *       setIsUploading(false)
 *     }
 *   }
 *
 *   return <button onClick={handleUpload}>Upload</button>
 * }
 * ```
 */
export function useNavigationGuard(enabled: boolean, message: string = DEFAULT_MESSAGE): void {
  // Handler for the beforeunload event
  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!enabled) {
        return;
      }

      // Standard way to trigger the dialog
      event.preventDefault();

      // Legacy support for older browsers
      // Note: Setting returnValue is required by some browsers
      event.returnValue = message;

      // Return the message (required by some older browsers)
      return message;
    },
    [enabled, message],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!enabled) {
      return;
    }

    // Add the event listener when guard is enabled
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up on unmount or when disabled
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, handleBeforeUnload]);
}
