import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Minimal popover-style dropdown. No portal — positions absolutely under the
 * trigger via `top-full`. Closes on outside click, Escape, or focus loss.
 */
export function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 192,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={
            'absolute z-50 mt-2 origin-top rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/10 ' +
            (align === 'right' ? 'right-0' : 'left-0')
          }
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  onSelect,
  selected,
  children,
  className = '',
}: {
  onSelect: () => void;
  selected?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ' +
        (selected
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800') +
        ' ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-slate-200 dark:border-slate-800" />;
}
