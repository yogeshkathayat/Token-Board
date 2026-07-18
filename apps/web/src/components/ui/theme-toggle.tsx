'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { getNextTheme, getThemeDisplayName, themes, useTheme } from '@/lib/hooks/use-theme';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'switch';
  className?: string;
}

/**
 * ThemeToggle Component
 *
 * A versatile theme toggle component with three variants:
 * - icon: Simple button that cycles through themes (default)
 * - dropdown: Dropdown menu with all theme options
 * - switch: Toggle switch for light/dark only
 */
export function ThemeToggle({ variant = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('h-10 w-10', className)}>
        <Button variant="ghost" size="icon" disabled>
          <span className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    );
  }

  if (variant === 'icon') {
    return <IconVariant theme={theme} setTheme={setTheme} className={className} />;
  }

  if (variant === 'dropdown') {
    return <DropdownVariant theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} className={className} />;
  }

  if (variant === 'switch') {
    return <SwitchVariant resolvedTheme={resolvedTheme} setTheme={setTheme} className={className} />;
  }

  return null;
}

interface VariantProps {
  theme?: string;
  setTheme: (theme: string) => void;
  resolvedTheme?: string;
  className?: string;
}

/**
 * Icon Variant - Cycles through themes on click
 */
function IconVariant({ theme, setTheme, className }: VariantProps) {
  const handleClick = () => {
    setTheme(getNextTheme(theme));
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} className={className}>
      {theme === 'light' && <Sun className="h-5 w-5" />}
      {theme === 'dark' && <Moon className="h-5 w-5" />}
      {theme === 'system' && <Monitor className="h-5 w-5" />}
      {!theme && <Monitor className="h-5 w-5" />}
      <span className="sr-only">Toggle theme (current: {getThemeDisplayName(theme)})</span>
    </Button>
  );
}

/**
 * Dropdown Variant - Shows all theme options in a menu
 */
function DropdownVariant({ theme, setTheme, className }: VariantProps) {
  const getIcon = (themeOption: string) => {
    switch (themeOption) {
      case 'light':
        return <Sun className="mr-2 h-4 w-4" />;
      case 'dark':
        return <Moon className="mr-2 h-4 w-4" />;
      case 'system':
        return <Monitor className="mr-2 h-4 w-4" />;
      default:
        return null;
    }
  };

  const getCurrentIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-5 w-5" />;
      case 'dark':
        return <Moon className="h-5 w-5" />;
      case 'system':
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          {getCurrentIcon()}
          <span className="sr-only">Select theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((themeOption) => (
          <DropdownMenuItem
            key={themeOption}
            onClick={() => setTheme(themeOption)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center">
              {getIcon(themeOption)}
              <span>{getThemeDisplayName(themeOption)}</span>
            </div>
            {theme === themeOption && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Switch Variant - Toggle between light and dark only
 */
function SwitchVariant({ resolvedTheme, setTheme, className }: VariantProps) {
  const isDark = resolvedTheme === 'dark';

  const handleChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch checked={isDark} onCheckedChange={handleChange} aria-label="Toggle dark mode" />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
