import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface InfoBoxProps {
  title: string;
  variant?: 'default' | 'info' | 'warning' | 'success';
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

const variantStyles = {
  default: {
    container: 'bg-slate-50/50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-800',
    title: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500 dark:bg-slate-400',
  },
  info: {
    container: 'bg-blue-50/50 border-blue-100 dark:bg-blue-950/50 dark:border-blue-900',
    title: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500 dark:bg-blue-400',
  },
  warning: {
    container: 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/50 dark:border-amber-900',
    title: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  success: {
    container: 'bg-green-50/50 border-green-100 dark:bg-green-950/50 dark:border-green-900',
    title: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500 dark:bg-green-400',
  },
};

const defaultIcons = {
  default: Info,
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

function InfoBox({ title, variant = 'default', children, icon, className }: InfoBoxProps) {
  const styles = variantStyles[variant];
  // Icon is available for future use when design requires it
  const _Icon = icon || defaultIcons[variant];
  void _Icon;

  return (
    <div className={cn('space-y-3 p-3 rounded-lg border', styles.container, className)}>
      <h4 className={cn('text-sm font-semibold flex items-center gap-2', styles.title)}>
        <div className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
        {title}
      </h4>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}
InfoBox.displayName = 'InfoBox';

export { InfoBox, type InfoBoxProps };
