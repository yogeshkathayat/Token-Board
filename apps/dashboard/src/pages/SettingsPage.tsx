import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApiClient } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';

interface Visibility {
  enabled: boolean;
  display_name: string | null;
  anonymous: boolean;
  updated_at: string | null;
}

export function SettingsPage() {
  const { user } = useAuth();
  const client = useApiClient();
  const [vis, setVis] = useState<Visibility | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.request<Visibility>('/public-visibility').then(setVis).catch((e) => setError(String(e)));
  }, [client]);

  async function update(patch: Partial<Visibility>) {
    if (!vis) return;
    setSaving(true);
    setError(null);
    try {
      const next = await client.request<Visibility>('/public-visibility', {
        method: 'POST',
        body: { ...vis, ...patch },
      });
      setVis(next);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500">
          Account · {user?.email}
          {user?.role === 'admin' && (
            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">admin</span>
          )}
        </p>
      </header>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Leaderboard visibility</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose whether other engineers in your org can see your name on the leaderboard.
        </p>

        {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</div>}

        <div className="mt-4 space-y-4">
          <Toggle
            label="Show my profile on the leaderboard"
            hint="When off, you still rank but appear as 'Anonymous'."
            checked={Boolean(vis?.enabled)}
            onChange={(v) => void update({ enabled: v })}
            disabled={saving || !vis}
          />

          {vis?.enabled && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Display name</span>
                <input
                  className="input"
                  defaultValue={vis.display_name ?? ''}
                  placeholder={user?.display_name ?? user?.email ?? ''}
                  maxLength={64}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next !== (vis.display_name ?? '')) {
                      void update({ display_name: next || null });
                    }
                  }}
                />
              </label>
              <Toggle
                label="Anonymous mode"
                hint="Render as 'Anonymous' even when public."
                checked={Boolean(vis.anonymous)}
                onChange={(v) => void update({ anonymous: v })}
                disabled={saving}
              />
            </>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Devices</h2>
        <p className="mt-1 text-sm text-slate-500">
          Link your laptops to this account. The CLI exchanges a short-lived link code for a device token.
        </p>
        <Link to="/settings/devices" className="btn-secondary mt-4 inline-flex">
          Manage devices →
        </Link>
      </section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ' +
          (checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700') +
          (disabled ? ' opacity-50' : '')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 rounded-full bg-white shadow transition ' +
            (checked ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </div>
  );
}
