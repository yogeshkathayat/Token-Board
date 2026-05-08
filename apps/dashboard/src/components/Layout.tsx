import { useLocation } from 'react-router-dom';
import { NavLink, Outlet } from 'react-router-dom';

import { LogoWordmark } from './Logo';
import { TopBar } from './TopBar';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
}

const NAV: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M3 12V5a2 2 0 012-2h2a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2zm8-7v10a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2zm-8 11a2 2 0 002 2h2a2 2 0 002-2v-1H3v1z" />
      </svg>
    ),
  },
  {
    to: '/leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M5 12h2v6H5v-6zm4-4h2v10H9V8zm4 6h2v4h-2v-4zM3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
      </svg>
    ),
  },
  {
    to: '/limits',
    label: 'Limits',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm.75-9.5a.75.75 0 00-1.5 0v3.5l2.5 1.5a.75.75 0 10.75-1.3l-1.75-1.05V6.5z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.49 3.17l.27 1.32a6.04 6.04 0 011.66.96l1.28-.45a1 1 0 011.18.4l1 1.74a1 1 0 01-.18 1.24l-1.02.9a6 6 0 010 1.94l1.02.9a1 1 0 01.18 1.24l-1 1.74a1 1 0 01-1.18.4l-1.28-.45a6 6 0 01-1.66.96l-.27 1.32a1 1 0 01-.98.8H9.49a1 1 0 01-.98-.8l-.27-1.32a6 6 0 01-1.66-.96l-1.28.45a1 1 0 01-1.18-.4l-1-1.74a1 1 0 01.18-1.24l1.02-.9a6 6 0 010-1.94l-1.02-.9a1 1 0 01-.18-1.24l1-1.74a1 1 0 011.18-.4l1.28.45a6 6 0 011.66-.96l.27-1.32a1 1 0 01.98-.8h1.02a1 1 0 01.98.8zM10 13a3 3 0 100-6 3 3 0 000 6z"
        />
      </svg>
    ),
  },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leaderboard': 'Leaderboard',
  '/limits': 'Limits',
  '/settings': 'Settings',
  '/settings/devices': 'Devices',
};

export function Layout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? '';
  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-8 px-2 pt-1">
          <LogoWordmark size={26} className="text-base" />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ' +
                (isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              <span className="opacity-70 group-hover:opacity-100">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-gradient-to-br from-brand-50 to-cyan-50 p-3 text-xs text-slate-600 dark:from-brand-900/30 dark:to-cyan-900/20 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Connect a device</div>
          <p className="mt-1 leading-snug">
            Run the CLI on a laptop to start tracking your AI usage automatically.
          </p>
          <NavLink
            to="/settings/devices"
            className="mt-2 inline-block font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Get started →
          </NavLink>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar pageTitle={title} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
