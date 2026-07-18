'use client';

import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Column, Table } from '@tanstack/react-table';
import { Eye, EyeOff, GripVertical, Settings2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// ============================================================================
// Sortable Column Item
// ============================================================================

interface SortableColumnItemProps<TData> {
  column: Column<TData, unknown>;
  id: string;
}

function SortableColumnItem<TData>({ column, id }: SortableColumnItemProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const canHide = column.getCanHide();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center space-x-2 rounded-md px-2 py-1.5 transition-colors',
        isDragging && 'bg-accent opacity-50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none focus:outline-none active:cursor-grabbing"
        type="button"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      {canHide ? (
        <>
          <Checkbox
            id={`column-${column.id}`}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          />
          <label
            htmlFor={`column-${column.id}`}
            className="flex flex-1 cursor-pointer items-center gap-2 text-sm capitalize"
          >
            {column.getIsVisible() ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{column.id}</span>
          </label>
        </>
      ) : (
        <span className="flex-1 text-sm capitalize truncate">{column.id}</span>
      )}
    </div>
  );
}

// ============================================================================
// Data Table View Options
// ============================================================================

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  onColumnOrderChange?: (columnOrder: string[]) => void;
}

export function DataTableViewOptions<TData>({ table, onColumnOrderChange }: DataTableViewOptionsProps<TData>) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Get all columns except the selection checkbox
  const allReorderableColumns = table
    .getAllColumns()
    .filter((column) => column.id !== 'select');

  // Sort by current column order state so the list reflects the actual order
  const columnOrderState = table.getState().columnOrder;
  const reorderableColumns =
    columnOrderState.length > 0
      ? [...allReorderableColumns].sort((a, b) => {
          const aIndex = columnOrderState.indexOf(a.id);
          const bIndex = columnOrderState.indexOf(b.id);
          return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
        })
      : allReorderableColumns;

  const columnIds = reorderableColumns.map((col) => col.id);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);

    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnIds.indexOf(active.id as string);
      const newIndex = columnIds.indexOf(over.id as string);
      const newOrder = arrayMove(columnIds, oldIndex, newIndex);

      // Prepend the select column if it exists
      const selectColumn = table.getAllColumns().find((col) => col.id === 'select');
      const fullNewOrder = selectColumn ? ['select', ...newOrder] : newOrder;

      table.setColumnOrder(fullNewOrder);
      onColumnOrderChange?.(fullNewOrder);
    }
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent closing while a drag is in progress
    if (!open && isDragging) return;
    setIsOpen(open);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          <GripVertical className="h-3 w-3" />
          Columns (drag to reorder)
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
            <div className="max-h-[300px] overflow-y-auto p-1">
              {reorderableColumns.map((column) => (
                <SortableColumnItem key={column.id} column={column} id={column.id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}
