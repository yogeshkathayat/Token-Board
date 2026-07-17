'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void;
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
  /** Callback when the user confirms */
  onConfirm: () => void | Promise<void>;
  /** Callback when the user cancels */
  onCancel?: () => void;
  /** Whether the confirm action is in progress */
  loading?: boolean;
}

/**
 * A higher-level confirmation dialog component that wraps AlertDialog
 * for common confirmation use cases.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Delete item?"
 *   description="This action cannot be undone."
 *   confirmLabel="Delete"
 *   variant="destructive"
 *   onConfirm={handleDelete}
 *   loading={isDeleting}
 * />
 * ```
 */
const ConfirmationDialog = React.forwardRef<React.ComponentRef<typeof AlertDialogContent>, ConfirmationDialogProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      variant = 'default',
      onConfirm,
      onCancel,
      loading = false,
    },
    ref,
  ) => {
    const handleCancel = React.useCallback(() => {
      onCancel?.();
      onOpenChange(false);
    }, [onCancel, onOpenChange]);

    const handleConfirm = React.useCallback(
      async (event: React.MouseEvent) => {
        event.preventDefault(); // Prevent AlertDialogAction from auto-closing
        await onConfirm();
        onOpenChange(false);
      },
      [onConfirm, onOpenChange],
    );

    return (
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!loading) onOpenChange(value);
        }}
      >
        <AlertDialogContent ref={ref}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={loading}>
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className={cn(variant === 'destructive' && buttonVariants({ variant: 'destructive' }))}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
ConfirmationDialog.displayName = 'ConfirmationDialog';

export { ConfirmationDialog };
