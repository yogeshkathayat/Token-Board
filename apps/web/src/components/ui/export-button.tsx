'use client';

import { Download, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { type ColumnConfig, exportToCSV, exportToExcel, exportToJSON } from '@/lib/export';
import { cn } from '@/lib/utils';

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface ExportButtonProps<T extends Record<string, unknown>> extends Omit<ButtonProps, 'onClick'> {
  /** The data to export */
  data: T[];
  /** Base filename (extension will be added based on format) */
  filename: string;
  /** Export format (default: 'csv') */
  format?: ExportFormat;
  /** Columns to include in export */
  columns?: Array<ColumnConfig<T>>;
  /** Callback when export completes */
  onExportComplete?: () => void;
  /** Callback when export fails */
  onExportError?: (error: Error) => void;
}

/**
 * ExportButton Component
 *
 * A button that triggers a file download in the specified format.
 *
 * @example
 * ```tsx
 * <ExportButton
 *   data={users}
 *   filename="users-export"
 *   format="csv"
 *   columns={['name', 'email']}
 * >
 *   Export Users
 * </ExportButton>
 * ```
 */
function ExportButtonInner<T extends Record<string, unknown>>(
  {
    data,
    filename,
    format = 'csv',
    columns,
    variant = 'outline',
    size = 'default',
    disabled,
    className,
    children,
    onExportComplete,
    onExportError,
    ...props
  }: ExportButtonProps<T>,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = React.useCallback(async () => {
    if (data.length === 0) return;

    setIsExporting(true);

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      switch (format) {
        case 'csv':
          exportToCSV(data, filename, { columns });
          break;
        case 'excel':
          exportToExcel(data, filename, { columns });
          break;
        case 'json':
          exportToJSON(data, filename);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      onExportComplete?.();
    } catch (error) {
      const exportError = error instanceof Error ? error : new Error('Export failed');
      onExportError?.(exportError);
      console.error('Export error:', exportError);
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, format, columns, onExportComplete, onExportError]);

  const isDisabled = disabled || data.length === 0 || isExporting;

  const formatLabels: Record<ExportFormat, string> = {
    csv: 'CSV',
    excel: 'Excel',
    json: 'JSON',
  };

  const defaultContent = (
    <>
      {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {isExporting ? 'Exporting...' : `Export ${formatLabels[format]}`}
    </>
  );

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={handleExport}
      className={cn(className)}
      {...props}
    >
      {children ?? defaultContent}
    </Button>
  );
}

// Use a type assertion to preserve generics through forwardRef
export const ExportButton = React.forwardRef(ExportButtonInner) as <T extends Record<string, unknown>>(
  props: ExportButtonProps<T> & { ref?: React.ForwardedRef<HTMLButtonElement> },
) => React.ReactElement;

// Display name for DevTools
(ExportButton as React.FC).displayName = 'ExportButton';
