'use client';

import { HelpCircle, LayoutDashboard, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { signOut } from '@/lib/auth/client';
import { getNextTheme, useKeyboardShortcut, useTheme } from '@/lib/hooks';

interface NavigationItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
}

interface ActionItem {
  title: string;
  onSelect: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
}

export interface CommandPaletteProps {
  /** Navigation items - links to pages */
  navigation?: NavigationItem[];
  /** Actions - callbacks that execute when selected */
  actions?: ActionItem[];
  /** Search callback for custom search behavior */
  onSearch?: (query: string) => void;
  /** Custom groups to render */
  children?: React.ReactNode;
}

// Default navigation items
const defaultNavigation: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    shortcut: ['G', 'D'],
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    shortcut: ['G', 'S'],
  },
  {
    title: 'Help',
    href: '/help',
    icon: HelpCircle,
    shortcut: ['G', 'H'],
  },
];

export function CommandPalette({
  navigation = defaultNavigation,
  actions: customActions,
  onSearch,
  children,
}: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Register Cmd+K / Ctrl+K keyboard shortcut
  useKeyboardShortcut(['meta', 'k'], () => {
    setOpen((prev) => !prev);
  });

  // Handle navigation item selection
  const handleNavigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Handle theme toggle
  const handleThemeToggle = React.useCallback(() => {
    const nextTheme = getNextTheme(theme);
    setTheme(nextTheme);
    setOpen(false);
  }, [theme, setTheme]);

  // Handle sign out
  const handleSignOut = React.useCallback(() => {
    setOpen(false);
    signOut();
  }, []);

  // Get theme icon based on current theme
  const getThemeIcon = React.useCallback(() => {
    switch (theme) {
      case 'light':
        return Sun;
      case 'dark':
        return Moon;
      default:
        return Monitor;
    }
  }, [theme]);

  // Default actions
  const defaultActions: ActionItem[] = React.useMemo(
    () => [
      {
        title: `Toggle theme (${theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light'})`,
        onSelect: handleThemeToggle,
        icon: getThemeIcon(),
        shortcut: ['T'],
      },
      {
        title: 'Sign out',
        onSelect: handleSignOut,
        icon: LogOut,
      },
    ],
    [handleThemeToggle, handleSignOut, getThemeIcon, theme],
  );

  // Merge custom actions with defaults
  const actions = customActions ? [...customActions, ...defaultActions] : defaultActions;

  // Handle search value changes
  const handleSearchChange = React.useCallback(
    (value: string) => {
      onSearch?.(value);
    },
    [onSearch],
  );

  // Format shortcut keys for display
  const formatShortcut = (keys: string[]) => {
    return keys.join('');
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." onValueChange={handleSearchChange} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation group */}
        {navigation.length > 0 && (
          <CommandGroup heading="Navigation">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={item.title} onSelect={() => handleNavigate(item.href)}>
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{item.title}</span>
                  {item.shortcut && <CommandShortcut>{formatShortcut(item.shortcut)}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Separator between groups */}
        {navigation.length > 0 && actions.length > 0 && <CommandSeparator />}

        {/* Actions group */}
        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <CommandItem key={`action-${index}-${action.title}`} value={action.title} onSelect={action.onSelect}>
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{action.title}</span>
                  {action.shortcut && <CommandShortcut>{formatShortcut(action.shortcut)}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Custom children groups */}
        {children}
      </CommandList>
    </CommandDialog>
  );
}

// Export a context provider for controlling the command palette from outside
interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return <CommandPaletteContext.Provider value={{ open, setOpen }}>{children}</CommandPaletteContext.Provider>;
}
