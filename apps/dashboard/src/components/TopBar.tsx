import { Dropdown, DropdownDivider, DropdownItem } from './Dropdown';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

const SunIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M10 4a1 1 0 011 1v1a1 1 0 11-2 0V5a1 1 0 011-1zm0 9a3 3 0 100-6 3 3 0 000 6zm5-3a1 1 0 11-2 0 1 1 0 012 0zm-9 0a1 1 0 11-2 0 1 1 0 012 0zm7.07-4.07a1 1 0 010 1.41l-.7.7a1 1 0 11-1.42-1.41l.71-.7a1 1 0 011.41 0zm-7.78 7.78a1 1 0 010 1.41l-.71.71a1 1 0 11-1.41-1.42l.7-.7a1 1 0 011.42 0zm9.19 0a1 1 0 011.42 0l.7.7a1 1 0 11-1.41 1.42l-.71-.71a1 1 0 010-1.41zM4.22 5.93a1 1 0 011.41 0l.71.7a1 1 0 11-1.42 1.41l-.7-.7a1 1 0 010-1.41zM10 14a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M17.293 13.293a8 8 0 01-10.586-10.586 8.001 8.001 0 1010.586 10.586z" />
  </svg>
);
const MonitorIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-3v2h2a1 1 0 110 2H6a1 1 0 110-2h2v-2H5a2 2 0 01-2-2V4zm2 0v8h10V4H5z" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 opacity-60">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
    />
  </svg>
);

const THEME_LABEL: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

function ThemeIcon({ mode, resolved }: { mode: ThemeMode; resolved: 'light' | 'dark' }) {
  if (mode === 'system') return <MonitorIcon />;
  if (resolved === 'dark') return <MoonIcon />;
  return <SunIcon />;
}

export function TopBar({ pageTitle }: { pageTitle?: string }) {
  const { mode, resolved, setMode } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80 md:px-8">
      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{pageTitle ?? ''}</div>

      <div className="flex items-center gap-2">
        {/* Theme dropdown */}
        <Dropdown
          align="right"
          width={160}
          trigger={(open) => (
            <span
              className={
                'inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ' +
                (open ? 'ring-2 ring-brand-500/40' : '')
              }
            >
              <ThemeIcon mode={mode} resolved={resolved} />
              <span>{THEME_LABEL[mode]}</span>
              <ChevronIcon />
            </span>
          )}
        >
          {(close) => (
            <>
              <DropdownItem
                selected={mode === 'light'}
                onSelect={() => {
                  setMode('light');
                  close();
                }}
              >
                <SunIcon />
                <span>Light</span>
              </DropdownItem>
              <DropdownItem
                selected={mode === 'dark'}
                onSelect={() => {
                  setMode('dark');
                  close();
                }}
              >
                <MoonIcon />
                <span>Dark</span>
              </DropdownItem>
              <DropdownItem
                selected={mode === 'system'}
                onSelect={() => {
                  setMode('system');
                  close();
                }}
              >
                <MonitorIcon />
                <span>System</span>
              </DropdownItem>
            </>
          )}
        </Dropdown>

        {/* User menu */}
        <Dropdown
          align="right"
          width={240}
          trigger={(open) => (
            <span
              className={
                'inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-1 pr-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ' +
                (open ? 'ring-2 ring-brand-500/40' : '')
              }
            >
              <Avatar name={user?.display_name || user?.email} seed={user?.id} size={26} />
              <span className="hidden max-w-[140px] truncate sm:inline">
                {user?.display_name || user?.email || 'Account'}
              </span>
              <ChevronIcon />
            </span>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 pb-2 pt-2">
                <div className="truncate text-sm font-semibold">
                  {user?.display_name || user?.email}
                </div>
                <div className="truncate text-xs text-slate-500">{user?.email}</div>
                {user?.role === 'admin' && (
                  <span className="mt-1.5 inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                    admin
                  </span>
                )}
              </div>
              <DropdownDivider />
              <DropdownItem
                onSelect={() => {
                  close();
                  void signOut();
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3 4a2 2 0 012-2h6a2 2 0 012 2v2a1 1 0 11-2 0V4H5v12h6v-2a1 1 0 112 0v2a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm9.293 5.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L13.586 13H8a1 1 0 110-2h5.586l-1.293-1.293a1 1 0 010-1.414z"
                  />
                </svg>
                <span>Sign out</span>
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
