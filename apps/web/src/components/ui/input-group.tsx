'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface InputGroupProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  leadingAddon?: React.ReactNode;
  trailingAddon?: React.ReactNode;
}

const InputGroup = React.forwardRef<HTMLInputElement, InputGroupProps>(
  ({ className, leadingIcon, trailingIcon, leadingAddon, trailingAddon, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leadingAddon && (
          <div className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {leadingAddon}
          </div>
        )}
        {leadingIcon && (
          <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            {leadingIcon}
          </div>
        )}
        <Input
          ref={ref}
          className={cn(
            leadingIcon && 'pl-10',
            trailingIcon && 'pr-10',
            leadingAddon && 'rounded-l-none',
            trailingAddon && 'rounded-r-none',
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <div className="pointer-events-none absolute right-3 flex items-center text-muted-foreground">
            {trailingIcon}
          </div>
        )}
        {trailingAddon && (
          <div className="flex h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {trailingAddon}
          </div>
        )}
      </div>
    );
  },
);
InputGroup.displayName = 'InputGroup';

export { InputGroup };
