import { AlertCircle } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
}

function ErrorState({ title = 'Something went wrong', message, retry, className }: ErrorStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
      <h3 className="mt-4 text-lg font-semibold text-destructive">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {retry && (
        <Button variant="outline" className="mt-4" onClick={retry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
ErrorState.displayName = 'ErrorState';

export { ErrorState, type ErrorStateProps };
