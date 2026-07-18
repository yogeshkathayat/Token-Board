/**
 * Export Utilities
 *
 * A collection of utilities for exporting data to various formats (CSV, JSON, Excel-compatible).
 * All functions use browser-native APIs (Blob, URL.createObjectURL) and are SSR-safe.
 */

/**
 * Column configuration for export
 */
export type ColumnConfig<T> = keyof T | { key: keyof T; label: string };

/**
 * Options for CSV export
 */
export interface CSVExportOptions<T> {
  /** Columns to include (and their order). Can be keys or objects with key and label. */
  columns?: Array<ColumnConfig<T>>;
  /** Delimiter character (default: ',') */
  delimiter?: string;
  /** Whether to include header row (default: true) */
  includeHeaders?: boolean;
}

/**
 * Options for JSON export
 */
export interface JSONExportOptions {
  /** Whether to pretty-print the JSON (default: true) */
  pretty?: boolean;
}

/**
 * Options for Excel-compatible export
 */
export interface ExcelExportOptions<T> {
  /** Columns to include (and their order). Can be keys or objects with key and label. */
  columns?: Array<ColumnConfig<T>>;
  /** Sheet name (for reference, stored in comment) */
  sheetName?: string;
}

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains special characters
 * - Escapes existing quotes by doubling them
 */
export function escapeCSVValue(value: string): string {
  // Check if the value needs to be quoted
  const needsQuoting = /[",\n\r]/.test(value);

  if (needsQuoting) {
    // Escape existing quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Formats a value for export
 * - Dates -> ISO string
 * - Numbers -> String representation
 * - Booleans -> 'Yes'/'No'
 * - Null/undefined -> Empty string
 * - Objects/Arrays -> JSON string
 */
export function formatValueForExport(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return String(value);
}

/**
 * Downloads a file to the user's device
 * Creates a temporary object URL, triggers download, then cleans up
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  // Ensure we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('downloadFile: Not in browser environment, skipping download');
    return;
  }

  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gets the column keys and labels from column config
 */
function getColumnInfo<T extends Record<string, unknown>>(
  columns: Array<ColumnConfig<T>> | undefined,
  data: T[],
): Array<{ key: keyof T; label: string }> {
  if (columns && columns.length > 0) {
    return columns.map((col) => {
      if (typeof col === 'object' && col !== null && 'key' in col) {
        return { key: col.key, label: col.label };
      }
      return { key: col as keyof T, label: String(col) };
    });
  }

  // If no columns specified, use all keys from first data item
  if (data.length > 0) {
    return Object.keys(data[0]).map((key) => ({
      key: key as keyof T,
      label: key,
    }));
  }

  return [];
}

/**
 * Exports data to CSV format
 *
 * @example
 * ```ts
 * exportToCSV(users, 'users.csv', {
 *   columns: [
 *     { key: 'name', label: 'Full Name' },
 *     'email',
 *     { key: 'createdAt', label: 'Created' }
 *   ]
 * })
 * ```
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  options?: CSVExportOptions<T>,
): void {
  const { columns, delimiter = ',', includeHeaders = true } = options ?? {};

  if (data.length === 0) {
    console.warn('exportToCSV: No data to export');
    return;
  }

  const columnInfo = getColumnInfo(columns, data);

  if (columnInfo.length === 0) {
    console.warn('exportToCSV: No columns to export');
    return;
  }

  const rows: string[] = [];

  // Add header row
  if (includeHeaders) {
    const headerRow = columnInfo.map((col) => escapeCSVValue(col.label)).join(delimiter);
    rows.push(headerRow);
  }

  // Add data rows
  for (const item of data) {
    const rowValues = columnInfo.map((col) => {
      const value = item[col.key];
      const formatted = formatValueForExport(value);
      return escapeCSVValue(formatted);
    });
    rows.push(rowValues.join(delimiter));
  }

  const csvContent = rows.join('\n');

  // Ensure .csv extension
  const csvFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  downloadFile(csvContent, csvFilename, 'text/csv;charset=utf-8');
}

/**
 * Exports data to JSON format
 *
 * @example
 * ```ts
 * exportToJSON(users, 'users.json', { pretty: true })
 * ```
 */
export function exportToJSON<T>(data: T[], filename: string, options?: JSONExportOptions): void {
  const { pretty = true } = options ?? {};

  const jsonContent = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

  // Ensure .json extension
  const jsonFilename = filename.endsWith('.json') ? filename : `${filename}.json`;

  downloadFile(jsonContent, jsonFilename, 'application/json;charset=utf-8');
}

/**
 * Exports data to Excel-compatible CSV format
 * - Adds BOM (Byte Order Mark) for proper UTF-8 recognition in Excel
 * - Uses .csv extension (Excel opens it correctly)
 *
 * @example
 * ```ts
 * exportToExcel(users, 'users', {
 *   columns: ['name', 'email'],
 *   sheetName: 'Users'
 * })
 * ```
 */
export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  options?: ExcelExportOptions<T>,
): void {
  const { columns, sheetName } = options ?? {};

  if (data.length === 0) {
    console.warn('exportToExcel: No data to export');
    return;
  }

  const columnInfo = getColumnInfo(columns, data);

  if (columnInfo.length === 0) {
    console.warn('exportToExcel: No columns to export');
    return;
  }

  const rows: string[] = [];

  // Add optional sheet name as comment (for reference)
  if (sheetName) {
    // This is just a comment that won't affect Excel parsing
    // Excel will use the filename as sheet name
  }

  // Add header row
  const headerRow = columnInfo.map((col) => escapeCSVValue(col.label)).join(',');
  rows.push(headerRow);

  // Add data rows
  for (const item of data) {
    const rowValues = columnInfo.map((col) => {
      const value = item[col.key];
      const formatted = formatValueForExport(value);
      return escapeCSVValue(formatted);
    });
    rows.push(rowValues.join(','));
  }

  const csvContent = rows.join('\r\n'); // Use CRLF for better Excel compatibility

  // Add UTF-8 BOM for Excel to recognize encoding
  const BOM = '\uFEFF';
  const contentWithBOM = BOM + csvContent;

  // Use .csv extension - Excel will open it correctly
  const excelFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  downloadFile(contentWithBOM, excelFilename, 'text/csv;charset=utf-8');
}

/**
 * Estimates the file size of exported data
 * Returns size in bytes
 */
export function estimateExportSize<T extends Record<string, unknown>>(
  data: T[],
  format: 'csv' | 'excel' | 'json',
): number {
  if (data.length === 0) return 0;

  if (format === 'json') {
    const jsonContent = JSON.stringify(data, null, 2);
    return new Blob([jsonContent]).size;
  }

  // For CSV/Excel, estimate based on string content
  const columns = Object.keys(data[0]);
  const headerSize = columns.join(',').length + 1; // +1 for newline

  // Sample first few rows to estimate average row size
  const sampleSize = Math.min(10, data.length);
  let totalSampleSize = 0;

  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];
    const rowContent = columns.map((col) => formatValueForExport(row[col])).join(',');
    totalSampleSize += rowContent.length + 1; // +1 for newline
  }

  const avgRowSize = totalSampleSize / sampleSize;
  const estimatedSize = headerSize + avgRowSize * data.length;

  // Add BOM size for Excel
  if (format === 'excel') {
    return estimatedSize + 3; // 3 bytes for UTF-8 BOM
  }

  return Math.round(estimatedSize);
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
