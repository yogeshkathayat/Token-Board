'use client';

import * as React from 'react';

import { type ColumnConfig, exportToCSV, exportToExcel, exportToJSON } from '@/lib/export';

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface UseExportOptions<T extends Record<string, unknown>> {
  /** The data to export */
  data: T[];
  /** Base filename (extension will be added based on format) */
  filename: string;
  /** Columns to include in export */
  columns?: Array<ColumnConfig<T>>;
  /** Callback when export completes */
  onComplete?: (format: ExportFormat) => void;
  /** Callback when export fails */
  onError?: (error: Error, format: ExportFormat) => void;
}

export interface UseExportReturn {
  /** Export data as CSV */
  exportCSV: () => void;
  /** Export data as Excel-compatible CSV */
  exportExcel: () => void;
  /** Export data as JSON */
  exportJSON: () => void;
  /** Export data in specified format */
  exportAs: (format: ExportFormat) => void;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** The format currently being exported (null if not exporting) */
  exportingFormat: ExportFormat | null;
  /** Whether there is data to export */
  canExport: boolean;
}

/**
 * useExport Hook
 *
 * A hook that provides export functionality for data tables and lists.
 *
 * @example
 * ```tsx
 * function UsersTable() {
 *   const { data } = useUsers()
 *
 *   const {
 *     exportCSV,
 *     exportExcel,
 *     exportJSON,
 *     isExporting,
 *     canExport
 *   } = useExport({
 *     data,
 *     filename: 'users-export',
 *     columns: ['name', 'email', 'role']
 *   })
 *
 *   return (
 *     <div>
 *       <button onClick={exportCSV} disabled={!canExport || isExporting}>
 *         {isExporting ? 'Exporting...' : 'Export CSV'}
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useExport<T extends Record<string, unknown>>(options: UseExportOptions<T>): UseExportReturn {
  const { data, filename, columns, onComplete, onError } = options;

  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);

  const exportAs = React.useCallback(
    async (format: ExportFormat) => {
      if (data.length === 0) {
        onError?.(new Error('No data to export'), format);
        return;
      }

      setExportingFormat(format);

      try {
        // Small delay to ensure loading state is visible
        await new Promise((resolve) => setTimeout(resolve, 50));

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

        onComplete?.(format);
      } catch (error) {
        const exportError = error instanceof Error ? error : new Error('Export failed');
        onError?.(exportError, format);
        console.error(`Export error (${format}):`, exportError);
      } finally {
        setExportingFormat(null);
      }
    },
    [data, filename, columns, onComplete, onError],
  );

  const exportCSV = React.useCallback(() => {
    exportAs('csv');
  }, [exportAs]);

  const exportExcel = React.useCallback(() => {
    exportAs('excel');
  }, [exportAs]);

  const exportJSON = React.useCallback(() => {
    exportAs('json');
  }, [exportAs]);

  return {
    exportCSV,
    exportExcel,
    exportJSON,
    exportAs,
    isExporting: exportingFormat !== null,
    exportingFormat,
    canExport: data.length > 0,
  };
}
