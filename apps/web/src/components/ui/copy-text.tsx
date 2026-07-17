'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export interface CopyTextProps {
  value: string;
  displayValue?: string;
  className?: string;
  iconClassName?: string;
  successMessage?: string;
  truncate?: boolean;
}

function CopyText({
  value,
  displayValue,
  className,
  iconClassName,
  successMessage = 'Copied to clipboard',
  truncate = false,
}: CopyTextProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      aria-label={`Copy ${displayValue ?? value} to clipboard`}
    >
      <span className={cn(truncate && 'max-w-[200px] truncate', 'select-none')}>{displayValue ?? value}</span>
      {copied ? (
        <Check className={cn('h-4 w-4 shrink-0 text-green-500', iconClassName)} aria-hidden="true" />
      ) : (
        <Copy className={cn('h-4 w-4 shrink-0 text-muted-foreground', iconClassName)} aria-hidden="true" />
      )}
    </button>
  );
}

export { CopyText };
