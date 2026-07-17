'use client';

import { ArrowRight, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Result of comparing two values at a specific key
 */
interface DiffResult {
  /** The key/path being compared */
  key: string;
  /** Type of change detected */
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  /** Original value (present for removed and changed) */
  oldValue?: unknown;
  /** New value (present for added and changed) */
  newValue?: unknown;
  /** Nested diff results for objects */
  children?: DiffResult[];
}

/**
 * Props for the JsonDiffViewer component
 */
interface JsonDiffViewerProps {
  /** The original/old JSON object */
  oldValue: Record<string, unknown>;
  /** The new/updated JSON object */
  newValue: Record<string, unknown>;
  /** Display mode: 'merged' shows single column, 'split' shows side-by-side */
  mode?: 'split' | 'merged';
  /** Whether to show unchanged fields */
  showUnchanged?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Checks if a value is a plain object (not null, not array)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if two values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Computes the diff between two objects recursively
 */
function computeDiff(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): DiffResult[] {
  const results: DiffResult[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldValue = oldObj[key];
    const newValue = newObj[key];
    const hasOld = key in oldObj;
    const hasNew = key in newObj;

    if (!hasOld && hasNew) {
      // Added
      results.push({
        key,
        type: 'added',
        newValue,
        children: isObject(newValue) ? computeDiff({}, newValue) : undefined,
      });
    } else if (hasOld && !hasNew) {
      // Removed
      results.push({
        key,
        type: 'removed',
        oldValue,
        children: isObject(oldValue) ? computeDiff(oldValue, {}) : undefined,
      });
    } else if (deepEqual(oldValue, newValue)) {
      // Unchanged
      results.push({
        key,
        type: 'unchanged',
        oldValue,
        newValue,
        children: isObject(oldValue) ? computeDiff(oldValue, newValue as Record<string, unknown>) : undefined,
      });
    } else {
      // Changed
      if (isObject(oldValue) && isObject(newValue)) {
        // Both are objects, recurse
        const children = computeDiff(oldValue, newValue);
        const hasChanges = children.some((c) => c.type !== 'unchanged');
        results.push({
          key,
          type: hasChanges ? 'changed' : 'unchanged',
          oldValue,
          newValue,
          children,
        });
      } else {
        // Primitive or type change
        results.push({
          key,
          type: 'changed',
          oldValue,
          newValue,
        });
      }
    }
  }

  // Sort: removed first, then changed, then added, then unchanged
  const order = { removed: 0, changed: 1, added: 2, unchanged: 3 };
  return results.sort((a, b) => order[a.type] - order[b.type]);
}

/**
 * Formats a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Returns the type badge variant based on diff type
 */
function getTypeVariant(type: DiffResult['type']): 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (type) {
    case 'added':
      return 'success';
    case 'removed':
      return 'destructive';
    case 'changed':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * Recursively checks if a DiffResult has any nested descendants with changes
 */
function hasNestedChanges(diff: DiffResult): boolean {
  if (!diff.children) return false;
  return diff.children.some((c) => c.type !== 'unchanged' || hasNestedChanges(c));
}

/**
 * Returns the type label text
 */
function getTypeLabel(type: DiffResult['type']): string {
  switch (type) {
    case 'added':
      return 'Added';
    case 'removed':
      return 'Removed';
    case 'changed':
      return 'Changed';
    default:
      return 'Unchanged';
  }
}

/**
 * Props for the DiffRow component
 */
interface DiffRowProps {
  diff: DiffResult;
  depth: number;
  showUnchanged: boolean;
  mode: 'split' | 'merged';
}

/**
 * Renders a single diff row with collapsible children
 */
function DiffRow({ diff, depth, showUnchanged, mode }: DiffRowProps) {
  const [isExpanded, setIsExpanded] = React.useState(diff.type !== 'unchanged');
  const hasChildren = diff.children && diff.children.length > 0;
  const isExpandable = hasChildren && (diff.type !== 'unchanged' || showUnchanged || hasNestedChanges(diff));

  // Filter visible children - keep unchanged children that have nested changes
  const visibleChildren = React.useMemo(() => {
    if (!diff.children) return [];
    return showUnchanged ? diff.children : diff.children.filter((c) => c.type !== 'unchanged' || hasNestedChanges(c));
  }, [diff.children, showUnchanged]);

  // Skip unchanged items if not showing them (unless they have changed descendants)
  const hasVisibleChanges = React.useMemo(() => {
    if (diff.type !== 'unchanged') return true;
    return hasNestedChanges(diff);
  }, [diff]);

  if (!showUnchanged && diff.type === 'unchanged' && !hasVisibleChanges) {
    return null;
  }

  const paddingLeft = depth * 16;

  if (mode === 'merged') {
    return (
      <div className="border-b border-border/50 last:border-b-0">
        <div
          className={cn(
            'flex items-start gap-2 py-2 pr-3 hover:bg-muted/50 transition-colors',
            diff.type === 'added' && 'bg-green-50/50 dark:bg-green-950/20',
            diff.type === 'removed' && 'bg-red-50/50 dark:bg-red-950/20',
            diff.type === 'changed' && 'bg-amber-50/50 dark:bg-amber-950/20',
          )}
          style={{ paddingLeft: paddingLeft + 8 }}
        >
          {/* Expand/collapse button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn('shrink-0 p-0.5 rounded hover:bg-muted', !isExpandable && 'invisible')}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {/* Key name */}
          <span className="font-mono text-sm font-medium text-foreground shrink-0 break-all">{diff.key}:</span>

          {/* Change type badge */}
          {diff.type !== 'unchanged' && (
            <Badge variant={getTypeVariant(diff.type)} className="shrink-0">
              {diff.type === 'added' && <Plus className="h-3 w-3" />}
              {diff.type === 'removed' && <Minus className="h-3 w-3" />}
              {diff.type === 'changed' && <ArrowRight className="h-3 w-3" />}
              {getTypeLabel(diff.type)}
            </Badge>
          )}

          {/* Values */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {!hasChildren && (
              <div className="font-mono text-sm break-all">
                {diff.type === 'removed' && (
                  <span className="text-red-600 dark:text-red-400 line-through">{formatValue(diff.oldValue)}</span>
                )}
                {diff.type === 'added' && (
                  <span className="text-green-600 dark:text-green-400">{formatValue(diff.newValue)}</span>
                )}
                {diff.type === 'changed' && (
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-red-600 dark:text-red-400 line-through">{formatValue(diff.oldValue)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-green-600 dark:text-green-400">{formatValue(diff.newValue)}</span>
                  </span>
                )}
                {diff.type === 'unchanged' && (
                  <span className="text-muted-foreground">{formatValue(diff.oldValue)}</span>
                )}
              </div>
            )}
            {hasChildren && !isExpanded && (
              <span className="text-muted-foreground font-mono text-sm">
                {isObject(diff.oldValue) || isObject(diff.newValue) ? '{...}' : '[...]'}
              </span>
            )}
          </div>
        </div>

        {/* Children */}
        {isExpanded && visibleChildren.length > 0 && (
          <div>
            {visibleChildren.map((child, index) => (
              <DiffRow
                key={`${child.key}-${index}`}
                diff={child}
                depth={depth + 1}
                showUnchanged={showUnchanged}
                mode={mode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Split view
  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-border">
        {/* Old value side */}
        <div
          className={cn(
            'py-2 px-3',
            diff.type === 'removed' && 'bg-red-50/50 dark:bg-red-950/20',
            diff.type === 'changed' && 'bg-red-50/30 dark:bg-red-950/10',
          )}
        >
          <div className="flex items-start gap-2 min-w-0" style={{ paddingLeft }}>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn('shrink-0 p-0.5 rounded hover:bg-muted', !isExpandable && 'invisible')}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <span className="font-mono text-sm font-medium text-foreground shrink-0 sm:hidden text-red-600 dark:text-red-400">
              Old
            </span>
            <span className="font-mono text-sm font-medium text-foreground shrink-0 break-all">{diff.key}:</span>
            <span className="min-w-0 break-all">
              {diff.type !== 'added' && !hasChildren && (
                <span
                  className={cn(
                    'font-mono text-sm break-all',
                    diff.type === 'removed' && 'text-red-600 dark:text-red-400',
                    diff.type === 'changed' && 'text-red-600 dark:text-red-400',
                    diff.type === 'unchanged' && 'text-muted-foreground',
                  )}
                >
                  {formatValue(diff.oldValue)}
                </span>
              )}
              {diff.type === 'added' && !hasChildren && (
                <span className="text-muted-foreground font-mono text-sm">-</span>
              )}
              {hasChildren && !isExpanded && <span className="text-muted-foreground font-mono text-sm">{'{...}'}</span>}
            </span>
          </div>
        </div>

        {/* New value side */}
        <div
          className={cn(
            'py-2 px-3',
            diff.type === 'added' && 'bg-green-50/50 dark:bg-green-950/20',
            diff.type === 'changed' && 'bg-green-50/30 dark:bg-green-950/10',
          )}
        >
          <div className="flex items-start gap-2 min-w-0" style={{ paddingLeft }}>
            <span className="font-mono text-sm font-medium text-foreground shrink-0 sm:hidden text-green-600 dark:text-green-400">
              New
            </span>
            <span className="font-mono text-sm font-medium text-foreground shrink-0 break-all">{diff.key}:</span>
            <span className="min-w-0 break-all">
              {diff.type !== 'removed' && !hasChildren && (
                <span
                  className={cn(
                    'font-mono text-sm break-all',
                    diff.type === 'added' && 'text-green-600 dark:text-green-400',
                    diff.type === 'changed' && 'text-green-600 dark:text-green-400',
                    diff.type === 'unchanged' && 'text-muted-foreground',
                  )}
                >
                  {formatValue(diff.newValue)}
                </span>
              )}
              {diff.type === 'removed' && !hasChildren && (
                <span className="text-muted-foreground font-mono text-sm">-</span>
              )}
              {hasChildren && !isExpanded && <span className="text-muted-foreground font-mono text-sm">{'{...}'}</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Children */}
      {isExpanded && visibleChildren.length > 0 && (
        <div>
          {visibleChildren.map((child, index) => (
            <DiffRow
              key={`${child.key}-${index}`}
              diff={child}
              depth={depth + 1}
              showUnchanged={showUnchanged}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A component for displaying the differences between two JSON objects.
 *
 * Supports two display modes:
 * - **Merged view** (default): Single column with color-coded badges showing additions (green),
 *   removals (red), and changes (amber). Changes display old and new values with an arrow.
 * - **Split view**: Side-by-side comparison with old values on the left and new values on the right.
 *   Differences are highlighted with background colors.
 *
 * Features:
 * - Deep comparison of nested objects and arrays
 * - Collapsible sections for nested structures
 * - Type change detection
 * - Handles null/undefined values
 * - Monospace font for values
 * - Scrollable container for large diffs
 *
 * @example
 * ```tsx
 * import { JsonDiffViewer } from '@/components/ui/json-diff-viewer'
 *
 * // Basic usage with merged view (default)
 * <JsonDiffViewer
 *   oldValue={{ name: 'John', age: 30 }}
 *   newValue={{ name: 'Jane', age: 30, email: 'jane@example.com' }}
 * />
 *
 * // Split view with unchanged fields visible
 * <JsonDiffViewer
 *   oldValue={originalData}
 *   newValue={updatedData}
 *   mode="split"
 *   showUnchanged={true}
 * />
 *
 * // Nested objects
 * <JsonDiffViewer
 *   oldValue={{
 *     user: { name: 'John', settings: { theme: 'light' } },
 *     version: 1
 *   }}
 *   newValue={{
 *     user: { name: 'John', settings: { theme: 'dark' } },
 *     version: 2
 *   }}
 * />
 * ```
 */
export function JsonDiffViewer({
  oldValue,
  newValue,
  mode = 'merged',
  showUnchanged = false,
  className,
}: JsonDiffViewerProps) {
  const diffs = React.useMemo(() => computeDiff(oldValue, newValue), [oldValue, newValue]);

  const visibleDiffs = React.useMemo(() => {
    if (showUnchanged) return diffs;
    return diffs.filter((d) => d.type !== 'unchanged' || hasNestedChanges(d));
  }, [diffs, showUnchanged]);

  if (visibleDiffs.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card text-card-foreground p-4 text-center text-muted-foreground',
          className,
        )}
      >
        No differences found
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground overflow-auto', className)}>
      {/* Header for split view */}
      {mode === 'split' && (
        <div className="hidden sm:grid grid-cols-2 divide-x divide-border border-b bg-muted/50">
          <div className="py-2 px-3 text-sm font-medium text-muted-foreground">Original</div>
          <div className="py-2 px-3 text-sm font-medium text-muted-foreground">Updated</div>
        </div>
      )}

      {/* Diff content */}
      <div className="max-h-[500px] overflow-auto">
        {visibleDiffs.map((diff, index) => (
          <DiffRow key={`${diff.key}-${index}`} diff={diff} depth={0} showUnchanged={showUnchanged} mode={mode} />
        ))}
      </div>

      {/* Summary footer */}
      <div className="border-t bg-muted/30 py-2 px-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {diffs.filter((d) => d.type === 'added').length} added
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {diffs.filter((d) => d.type === 'removed').length} removed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {diffs.filter((d) => d.type === 'changed').length} changed
        </span>
        {showUnchanged && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {diffs.filter((d) => d.type === 'unchanged').length} unchanged
          </span>
        )}
      </div>
    </div>
  );
}

export type { JsonDiffViewerProps, DiffResult };
