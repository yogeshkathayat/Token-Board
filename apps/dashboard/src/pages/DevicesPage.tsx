import { useEffect, useMemo, useState } from 'react';

import { useApiClient } from '../hooks/useApi';

interface LinkCode {
  link_code: string;
  expires_at: string;
}

export function DevicesPage() {
  const client = useApiClient();
  const [code, setCode] = useState<LinkCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const next = await client.request<LinkCode>('/auth/link-code-init', { method: 'POST' });
      setCode(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate a link code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const remainingMs = code ? new Date(code.expires_at).getTime() - now : 0;
  const expired = remainingMs <= 0;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const oneLiner = useMemo(() => {
    if (!code || !origin) return '';
    return `curl -fsSL ${origin}/install.sh?code=${code.link_code} | sh`;
  }, [code, origin]);

  const linkCommand = useMemo(() => {
    if (!code) return '';
    return `tokenboard link ${code.link_code}`;
  }, [code]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Devices</h1>
        <p className="text-sm text-slate-500">
          Connect a laptop to your account. Codes are 6 characters, expire in 10 minutes, and are single-use.
        </p>
      </header>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Connect a new laptop</h2>
        <button onClick={generate} disabled={busy} className="btn-primary mt-3">
          {busy ? 'Generating…' : code ? 'Generate another code' : 'Generate code'}
        </button>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {code && (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-slate-200 p-4 text-center dark:border-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">Your code</div>
              <div
                className={
                  'mt-1 font-mono text-3xl font-bold tracking-widest ' +
                  (expired ? 'text-slate-400 line-through' : '')
                }
              >
                {code.link_code}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {expired ? 'Expired — generate a new one.' : `Expires in ${Math.max(0, Math.floor(remainingMs / 1000))}s`}
              </div>
            </div>

            {!expired && (
              <>
                <Step
                  number={1}
                  title="Fresh laptop? Run the one-liner"
                  hint="Installs node + the CLI, links this device, asks once whether to start the background sync daemon."
                  command={oneLiner}
                />
                <Step
                  number={2}
                  title="Already have tokenboard installed?"
                  hint="Skips the install step."
                  command={linkCommand}
                />
              </>
            )}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">What happens after linking</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>• Hooks are installed for any AI tools detected on the laptop (Claude Code, Codex, Gemini, OpenCode).</li>
          <li>• Each AI session triggers a sync. Token counts (never prompts or replies) are uploaded.</li>
          <li>• A background daemon runs sync every 10 minutes for tools without hooks (Cursor, Copilot, OpenRouter).</li>
          <li>• Your usage shows up on the dashboard within ~30 seconds of the next sync.</li>
        </ul>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  hint,
  command,
}: {
  number: number;
  title: string;
  hint?: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-baseline gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
          {number}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {hint && <p className="ml-8 mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="ml-8 mt-3 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100">
          {command}
        </code>
        <button onClick={copy} className="btn-secondary px-3 py-1.5 text-xs">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
