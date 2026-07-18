'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

// ============================================
// Form Section Component
// ============================================

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Section title/heading
   */
  title: string;
  /**
   * Optional description text below the title
   */
  description?: string;
  /**
   * Children form fields
   */
  children: React.ReactNode;
}

/**
 * Groups related form fields with a heading and optional description.
 * Provides consistent spacing and styling for form sections.
 */
const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ title, description, children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
        <div className="space-y-1">
          <h3 className="text-lg font-medium leading-6">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    );
  },
);
FormSection.displayName = 'FormSection';

// ============================================
// Form Section Divider
// ============================================

type FormSectionDividerProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * A horizontal divider to separate form sections visually
 */
const FormSectionDivider = React.forwardRef<HTMLDivElement, FormSectionDividerProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('border-t border-border my-6', className)} {...props} />;
});
FormSectionDivider.displayName = 'FormSectionDivider';

// ============================================
// Form Row Component
// ============================================

interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns (1-4)
   * @default 2
   */
  columns?: 1 | 2 | 3 | 4;
  /**
   * Children form fields
   */
  children: React.ReactNode;
}

/**
 * Arranges form fields in a row with responsive grid layout.
 * Collapses to single column on smaller screens.
 */
const FormRow = React.forwardRef<HTMLDivElement, FormRowProps>(
  ({ columns = 2, children, className, ...props }, ref) => {
    const gridCols = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    };

    return (
      <div ref={ref} className={cn('grid gap-4', gridCols[columns], className)} {...props}>
        {children}
      </div>
    );
  },
);
FormRow.displayName = 'FormRow';

// ============================================
// Form Actions Component
// ============================================

interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Alignment of the buttons
   * @default "end"
   */
  align?: 'start' | 'center' | 'end' | 'between';
  /**
   * Children (typically buttons)
   */
  children: React.ReactNode;
}

/**
 * Container for form action buttons (submit, cancel, etc.)
 * Provides consistent spacing and alignment.
 */
const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
  ({ align = 'end', children, className, ...props }, ref) => {
    const alignmentClasses = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn('flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:gap-3', alignmentClasses[align], className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
FormActions.displayName = 'FormActions';

// ============================================
// Form Card Component
// ============================================

interface FormCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Card title
   */
  title?: string;
  /**
   * Optional description text
   */
  description?: string;
  /**
   * Children content
   */
  children: React.ReactNode;
}

/**
 * A card wrapper for forms with optional title and description.
 * Useful for standalone form pages or modal content.
 */
const FormCard = React.forwardRef<HTMLDivElement, FormCardProps>(
  ({ title, description, children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('rounded-lg border bg-card p-6 shadow-sm', className)} {...props}>
        {(title || description) && (
          <div className="mb-6 space-y-1">
            {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </div>
    );
  },
);
FormCard.displayName = 'FormCard';

export { FormSection, FormSectionDivider, FormRow, FormActions, FormCard };
