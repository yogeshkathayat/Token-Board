import { useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { useTheme } from '../context/ThemeContext';

export function LoginPage() {
  const { config, signInWithPassword, signUp, startOidc } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password);
      } else {
        await signUp(email, password, name || undefined);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const oidcEnabled = config?.oidc_enabled;
  const passwordSignup = config?.password_signup ?? true;

  return (
    <div className="relative mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="absolute right-6 top-6">
        <ThemePicker />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <div className="mt-3 text-xl font-bold tracking-tight">
            Token<span className="text-brand-500">Board</span>
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Track your team's AI coding tool usage.
        </p>

        {oidcEnabled && (
          <button onClick={startOidc} className="btn-secondary mt-6 w-full">
            Continue with SSO
          </button>
        )}

        {oidcEnabled && (
          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            or
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block">
              <span className="mb-1 block text-sm">Name (optional)</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm">Email</span>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">Password</span>
            <input
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {passwordSignup && (
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemePicker() {
  const { mode, setMode } = useTheme();
  return (
    <Dropdown
      align="right"
      width={140}
      trigger={(open) => (
        <span
          className={
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ' +
            (open ? 'ring-2 ring-brand-500/40' : '')
          }
        >
          {mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '🖥️'} <span className="capitalize">{mode}</span>
        </span>
      )}
    >
      {(close) => (
        <>
          <DropdownItem selected={mode === 'light'} onSelect={() => { setMode('light'); close(); }}>
            ☀️ Light
          </DropdownItem>
          <DropdownItem selected={mode === 'dark'} onSelect={() => { setMode('dark'); close(); }}>
            🌙 Dark
          </DropdownItem>
          <DropdownItem selected={mode === 'system'} onSelect={() => { setMode('system'); close(); }}>
            🖥️ System
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
