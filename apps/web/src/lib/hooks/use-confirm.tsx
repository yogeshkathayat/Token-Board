'use client';

import * as React from 'react';

import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export interface ConfirmOptions {
  /** The title of the confirmation dialog */
  title: string;
  /** The description/message of the confirmation dialog */
  description: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Visual variant - default or destructive */
  variant?: 'default' | 'destructive';
}

export interface UseConfirmReturn {
  /**
   * Opens a confirmation dialog and returns a promise that resolves to
   * true if confirmed, false if cancelled.
   *
   * @example
   * ```tsx
   * const confirmed = await confirm({
   *   title: "Delete item?",
   *   description: "This action cannot be undone.",
   *   variant: "destructive",
   * })
   *
   * if (confirmed) {
   *   await deleteItem()
   * }
   * ```
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /**
   * The dialog component that must be rendered in the component tree.
   * Place this at the end of your component's JSX.
   *
   * @example
   * ```tsx
   * function MyComponent() {
   *   const { confirm, ConfirmDialog } = useConfirm()
   *
   *   return (
   *     <>
   *       <button onClick={handleDelete}>Delete</button>
   *       <ConfirmDialog />
   *     </>
   *   )
   * }
   * ```
   */
  ConfirmDialog: React.FC;
}

/**
 * A hook that provides an imperative API for confirmation dialogs.
 *
 * @example
 * ```tsx
 * function DeleteButton({ itemId }: { itemId: string }) {
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   const [isDeleting, setIsDeleting] = useState(false)
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: "Delete item?",
 *       description: "This action cannot be undone. The item will be permanently deleted.",
 *       confirmLabel: "Delete",
 *       cancelLabel: "Cancel",
 *       variant: "destructive",
 *     })
 *
 *     if (confirmed) {
 *       setIsDeleting(true)
 *       try {
 *         await deleteItem(itemId)
 *         toast.success("Item deleted")
 *       } catch (error) {
 *         toast.error("Failed to delete item")
 *       } finally {
 *         setIsDeleting(false)
 *       }
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
 *         {isDeleting ? "Deleting..." : "Delete"}
 *       </Button>
 *       <ConfirmDialog />
 *     </>
 *   )
 * }
 * ```
 */
export function useConfirm(): UseConfirmReturn {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(confirmOptions);
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const handleCancel = React.useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!newOpen) {
      resolveRef.current?.(false);
      resolveRef.current = null;
    }
    setOpen(newOpen);
  }, []);

  const ConfirmDialog: React.FC = React.useCallback(
    () =>
      options ? (
        <ConfirmationDialog
          open={open}
          onOpenChange={handleOpenChange}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null,
    [open, options, handleOpenChange, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmDialog };
}
