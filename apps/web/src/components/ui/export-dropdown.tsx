'use client';

import { ChevronDown, Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type ColumnConfig,
  estimateExportSize,
  exportToCSV,
  exportToExcel,
  exportToJSON,
  formatFileSize,
} from '@/lib/export';
import { cn } from '@/lib/utils';

export type ExportFormat = 'csv' | 'excel' | 'json';

export interface ExportDropdownProps<T extends Record<string, unknown>> {
  /** The data to export */
  data: T[];
  /** Base filename (extension will be added based on format) */
  filename: string;
  /** Columns to include in export */
  columns?: Array<ColumnConfig<T>>;
  /** Formats to show in dropdown (default: all) */
  formats?: ExportFormat[];
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Additional class name for the trigger */
  className?: string;
  /** Show estimated file sizes */
  showFileSizes?: boolean;
  /** Callback when export completes */
  onExportComplete?: (format: ExportFormat) => void;
  /** Callback when export fails */
  onExportError?: (error: Error, format: ExportFormat) => void;
}

interface FormatConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  extension: string;
}

const formatConfigs: Record<ExportFormat, FormatConfig> = {
  csv: {
    label: 'CSV',
    description: 'Comma-separated values',
    icon: FileText,
    extension: '.csv',
  },
  excel: {
    label: 'Excel',
    description: 'Excel-compatible CSV',
    icon: FileSpreadsheet,
    extension: '.csv',
  },
  json: {
    label: 'JSON',
    description: 'JavaScript Object Notation',
    icon: FileJson,
    extension: '.json',
  },
};

/**
 * ExportDropdown Component
 *
 * A dropdown menu that allows users to choose an export format.
 *
 * @example
 * ```tsx
 * <ExportDropdown
 *   data={users}
 *   filename="users-export"
 *   formats={['csv', 'excel', 'json']}
 *   showFileSizes
 * />
 * ```
 */
export function ExportDropdown<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  formats = ['csv', 'excel', 'json'],
  trigger,
  disabled,
  className,
  showFileSizes = false,
  onExportComplete,
  onExportError,
}: ExportDropdownProps<T>) {
  const [isExporting, setIsExporting] = React.useState<ExportFormat | null>(null);

  const handleExport = React.useCallback(
    async (format: ExportFormat) => {
      if (data.length === 0) return;

      setIsExporting(format);

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

        onExportComplete?.(format);
      } catch (error) {
        const exportError = error instanceof Error ? error : new Error('Export failed');
        onExportError?.(exportError, format);
        console.error('Export error:', exportError);
      } finally {
        setIsExporting(null);
      }
    },
    [data, filename, columns, onExportComplete, onExportError],
  );

  const isDisabled = disabled || data.length === 0;

  const fileSizes = React.useMemo(() => {
    if (!showFileSizes || data.length === 0) return null;

    return formats.reduce(
      (acc, format) => {
        acc[format] = estimateExportSize(data, format);
        return acc;
      },
      {} as Record<ExportFormat, number>,
    );
  }, [data, formats, showFileSizes]);

  const defaultTrigger = (
    <Button variant="outline" disabled={isDisabled} className={cn('gap-2', className)}>
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export
      <ChevronDown className="h-4 w-4" />
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isDisabled}>
        {trigger ?? defaultTrigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((format) => {
          const config = formatConfigs[format];
          const Icon = config.icon;
          const isLoading = isExporting === format;
          const fileSize = fileSizes?.[format];

          return (
            <DropdownMenuItem
              key={format}
              onClick={() => handleExport(format)}
              disabled={isLoading}
              className="flex items-center gap-3 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="flex flex-col flex-1">
                <span className="font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">{config.description}</span>
              </div>
              {fileSize !== undefined && (
                <span className="text-xs text-muted-foreground">~{formatFileSize(fileSize)}</span>
              )}
            </DropdownMenuItem>
          );
        })}
        {data.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {data.length} {data.length === 1 ? 'row' : 'rows'} to export
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ExportDropdown.displayName = 'ExportDropdown';
