'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DataTablePagination } from './data-table-pagination';
import { type InlineFilterConfig } from './data-table-toolbar';
import { DataTableToolbar } from './data-table-toolbar';

// ============================================================================
// Table Primitives
// ============================================================================

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  enableColumnResize?: boolean;
  /** Total width of all columns combined (computed by DataTable) */
  totalWidth?: number;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, enableColumnResize, totalWidth, style, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn('caption-bottom text-sm w-full', className)}
          style={{
            ...style,
            ...(enableColumnResize ? { tableLayout: 'fixed' as const, minWidth: totalWidth } : {}),
          }}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />,
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)} {...props} />
  ),
);
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, style, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-2 [&:has([role=checkbox])]:pl-4 bg-muted/50',
        className,
      )}
      style={style}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, style, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-2 [&:has([role=checkbox])]:pl-4', className)}
      style={style}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  ),
);
TableCaption.displayName = 'TableCaption';

// ============================================================================
// Skeleton Row Component
// ============================================================================

interface SkeletonRowProps {
  columnCount: number;
  rowHeight?: number;
}

function SkeletonRow({ columnCount, rowHeight = 52 }: SkeletonRowProps) {
  return (
    <TableRow>
      {Array.from({ length: columnCount }).map((_, index) => (
        <TableCell key={`skeleton-cell-${index}`} style={{ height: rowHeight }}>
          <Skeleton className="h-6 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ============================================================================
// Data Table Component
// ============================================================================

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onRowClick?: (row: TData) => void;
  rowSelection?: boolean;
  columnVisibility?: boolean;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
  skeletonRowCount?: number;
  skeletonRowHeight?: number;
  onColumnSizeChange?: (columnId: string, width: number) => void;
  onColumnOrderChange?: (columnOrder: string[]) => void;
  defaultColumnSizes?: Record<string, number>;
  /** Called when row selection changes. Receives the array of currently selected row data. */
  onSelectionChange?: (selectedRows: TData[]) => void;
  /** Config-driven inline filter pills rendered in the toolbar */
  inlineFilters?: InlineFilterConfig[];
  /** Called when "Reset" is clicked to clear all inline filters */
  onClearFilters?: () => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  isLoading = false,
  pageSize = 10,
  pageSizeOptions = [10, 20, 30, 40, 50],
  onRowClick,
  rowSelection: enableRowSelection = false,
  columnVisibility: enableColumnVisibility = true,
  enableColumnResize = false,
  enableColumnReorder = false,
  skeletonRowCount,
  skeletonRowHeight = 52,
  onColumnSizeChange,
  onColumnOrderChange,
  defaultColumnSizes = {},
  onSelectionChange,
  inlineFilters,
  onClearFilters,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelectionState, setRowSelectionState] = React.useState({});
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([]);
  const [columnSizes, setColumnSizes] = React.useState<Record<string, number>>(defaultColumnSizes);

  // Use provided skeletonRowCount or fall back to pageSize
  const actualSkeletonRowCount = skeletonRowCount ?? pageSize;

  // Handle column resize
  const handleColumnResize = React.useCallback(
    (columnId: string, width: number) => {
      setColumnSizes((prev) => ({
        ...prev,
        [columnId]: width,
      }));
      onColumnSizeChange?.(columnId, width);
    },
    [onColumnSizeChange],
  );

  // Handle column order change
  const handleColumnOrderChange = React.useCallback(
    (newOrder: string[]) => {
      setColumnOrder(newOrder);
      onColumnOrderChange?.(newOrder);
    },
    [onColumnOrderChange],
  );

  // Column header drag-to-reorder state
  const [draggedColumnId, setDraggedColumnId] = React.useState<string | null>(null);
  const [targetColumnId, setTargetColumnId] = React.useState<string | null>(null);

  // Add selection column if row selection is enabled
  const tableColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectionColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
      minSize: 48,
      maxSize: 48,
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection: rowSelectionState,
      columnOrder,
    },
    enableRowSelection: enableRowSelection,
    onRowSelectionChange: setRowSelectionState,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: enableColumnResize,
    columnResizeMode: 'onChange',
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Reorder column via drag on headers
  const reorderColumn = React.useCallback(
    (draggedId: string, targetId: string) => {
      const currentCols = table.getVisibleLeafColumns().map((c) => c.id);
      const draggedIndex = currentCols.indexOf(draggedId);
      const targetIndex = currentCols.indexOf(targetId);
      if (draggedIndex === -1 || targetIndex === -1) return;

      const newCols = [...currentCols];
      const [moved] = newCols.splice(draggedIndex, 1);
      newCols.splice(targetIndex, 0, moved);
      table.setColumnOrder(newCols);
      onColumnOrderChange?.(newCols);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onColumnOrderChange, table],
  );

  // Notify parent when selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelectionState, onSelectionChange, table]);

  // Compute total width of columns that have explicit sizes (for minWidth scroll behavior)
  const totalWidth = React.useMemo(() => {
    if (!enableColumnResize) return undefined;
    const cols = table.getAllLeafColumns();
    let sum = 0;
    for (const col of cols) {
      sum += columnSizes[col.id] || col.getSize();
    }
    return sum;
  }, [enableColumnResize, columnSizes, table]);

  const handleRowClick = (row: Row<TData>) => {
    if (onRowClick) {
      onRowClick(row.original);
    }
  };

  return (
    <div className="space-y-4">
      {(searchKey || enableColumnVisibility || (inlineFilters && inlineFilters.length > 0)) && (
        <DataTableToolbar
          table={table}
          searchKey={searchKey}
          searchPlaceholder={searchPlaceholder}
          showColumnVisibility={enableColumnVisibility}
          onColumnOrderChange={handleColumnOrderChange}
          inlineFilters={inlineFilters}
          onClearFilters={onClearFilters}
        />
      )}
      <div className="rounded-md border">
        <Table enableColumnResize={enableColumnResize} totalWidth={totalWidth}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSelectColumn = header.column.id === 'select';
                  const columnWidth = columnSizes[header.column.id] || header.getSize();
                  const isDraggable = enableColumnReorder && !isSelectColumn;

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      draggable={isDraggable}
                      onDragStart={
                        isDraggable
                          ? (e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedColumnId(header.column.id);
                            }
                          : undefined
                      }
                      onDragOver={
                        isDraggable
                          ? (e) => {
                              e.preventDefault();
                              setTargetColumnId(header.column.id);
                            }
                          : undefined
                      }
                      onDrop={
                        isDraggable
                          ? (e) => {
                              e.preventDefault();
                              if (draggedColumnId && draggedColumnId !== header.column.id) {
                                reorderColumn(draggedColumnId, header.column.id);
                              }
                              setDraggedColumnId(null);
                              setTargetColumnId(null);
                            }
                          : undefined
                      }
                      onDragEnd={
                        isDraggable
                          ? () => {
                              setDraggedColumnId(null);
                              setTargetColumnId(null);
                            }
                          : undefined
                      }
                      className={cn(
                        enableColumnResize && !isSelectColumn && 'group/th',
                        isDraggable && 'cursor-grab active:cursor-grabbing',
                        draggedColumnId === header.column.id && 'opacity-50',
                        draggedColumnId &&
                          targetColumnId === header.column.id &&
                          draggedColumnId !== header.column.id &&
                          'border-l-2 border-l-primary',
                      )}
                      style={{
                        width: isSelectColumn ? 48 : enableColumnResize ? columnWidth : undefined,
                        minWidth: isSelectColumn ? 48 : enableColumnResize ? 60 : undefined,
                        maxWidth: isSelectColumn ? 48 : undefined,
                        position: 'relative',
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {enableColumnResize && !isSelectColumn && (
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const th = e.currentTarget.parentElement as HTMLElement;
                            const startWidth = th.getBoundingClientRect().width;
                            const startX = e.clientX;

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const deltaX = moveEvent.clientX - startX;
                              const newWidth = Math.max(60, startWidth + deltaX);
                              handleColumnResize(header.column.id, newWidth);
                            };

                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                              document.body.style.cursor = '';
                              document.body.style.userSelect = '';
                            };

                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            const th = e.currentTarget.parentElement as HTMLElement;
                            const startWidth = th.getBoundingClientRect().width;
                            const touch = e.touches[0];
                            const startX = touch.clientX;

                            const handleTouchMove = (moveEvent: TouchEvent) => {
                              moveEvent.preventDefault();
                              const currentTouch = moveEvent.touches[0];
                              const deltaX = currentTouch.clientX - startX;
                              const newWidth = Math.max(60, startWidth + deltaX);
                              handleColumnResize(header.column.id, newWidth);
                            };

                            const handleTouchEnd = () => {
                              document.removeEventListener('touchmove', handleTouchMove);
                              document.removeEventListener('touchend', handleTouchEnd);
                            };

                            document.addEventListener('touchmove', handleTouchMove, { passive: false });
                            document.addEventListener('touchend', handleTouchEnd);
                          }}
                          className={cn(
                            'absolute right-0 top-0 h-full w-2 cursor-col-resize select-none sm:w-1',
                            'opacity-0 group-hover/th:opacity-100 bg-primary/50 active:bg-primary active:opacity-100',
                            'after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:sm:-left-1 after:sm:-right-1',
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
                {/* Spacer column absorbs remaining width when resize is enabled */}
                {enableColumnResize && <th className="w-auto" />}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: actualSkeletonRowCount }).map((_, index) => (
                <SkeletonRow
                  key={`skeleton-${index}`}
                  columnCount={tableColumns.length}
                  rowHeight={skeletonRowHeight}
                />
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => handleRowClick(row)}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isSelectColumn = cell.column.id === 'select';
                    const cellWidth = columnSizes[cell.column.id] || cell.column.getSize();

                    return (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: isSelectColumn ? 48 : enableColumnResize ? cellWidth : undefined,
                          minWidth: isSelectColumn ? 48 : enableColumnResize ? 60 : undefined,
                          maxWidth: isSelectColumn ? 48 : undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                  {/* Spacer cell matches spacer header */}
                  {enableColumnResize && <td />}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length + (enableColumnResize ? 1 : 0)} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} showSelection={enableRowSelection} />
    </div>
  );
}

// Export table primitives for custom composition
export {
  Table as DataTableRoot,
  TableHeader as DataTableHeader,
  TableBody as DataTableBody,
  TableFooter as DataTableFooter,
  TableHead as DataTableHead,
  TableRow as DataTableRow,
  TableCell as DataTableCell,
  TableCaption as DataTableCaption,
};
