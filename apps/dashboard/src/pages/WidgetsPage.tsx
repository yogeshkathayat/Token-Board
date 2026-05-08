import { useState } from 'react';

import { useApi, useApiClient } from '../hooks/useApi';
import { formatTokensCompact, formatTokens } from '../lib/format';

interface SummaryResponse {
  totals: { total_tokens: string };
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
const TODAY = () => localDate(new Date());
const daysAgo = (n: number) => localDate(new Date(Date.now() - n * 86400_000));

export function WidgetsPage() {
  const today = useApi<SummaryResponse>('/usage/summary', {
    query: { from: TODAY(), to: TODAY(), tz: TZ },
  });
  const sevenDay = useApi<SummaryResponse>('/usage/summary', {
    query: { from: daysAgo(6), to: TODAY(), tz: TZ },
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const [copied, setCopied] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installCommand, setInstallCommand] = useState(
    `curl -fsSL ${origin}/install-widget.sh | sh -s -- ${origin}`,
  );
  const [hasPat, setHasPat] = useState(false);

  // Mint a PAT lazily on first click — gives the user a single command that
  // pre-fills the bar app's auth, so they never have to touch Settings.
  const apiClient = useApiClient();

  async function ensurePatThenCopy() {
    setError(null);
    let cmd = installCommand;
    if (!hasPat) {
      setMinting(true);
      try {
        const r = await apiClient.request<{ token: string }>('/auth/personal-token', {
          method: 'POST',
          body: { name: 'Menu bar widget' },
        });
        cmd = `curl -fsSL ${origin}/install-widget.sh | sh -s -- ${origin} ${r.token}`;
        setInstallCommand(cmd);
        setHasPat(true);
      } catch (e) {
        setError((e as Error).message ?? 'Could not mint a token');
        setMinting(false);
        return;
      }
      setMinting(false);
    }
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  function downloadManually() {
    const a = document.createElement('a');
    a.href = '/macos-widget.tar.gz';
    a.download = 'tokenboard-macos-widget.tar.gz';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-400">
            Desktop Widgets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your token usage, pinned to your menu bar.
          </p>
        </div>
      </header>

      <section>
        <PreviewCard
          today={today.data?.totals.total_tokens}
          sevenDay={sevenDay.data?.totals.total_tokens}
        />
      </section>

      <section>
        <div className="rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-cyan-500 p-px shadow-xl shadow-brand-500/20">
          <div className="rounded-2xl bg-white p-6 dark:bg-slate-950 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Install in one paste
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  Copy this, paste in Terminal, hit Enter
                </h2>
              </div>
              <TerminalIcon />
            </div>

            <button
              onClick={ensurePatThenCopy}
              disabled={minting}
              className="group mt-5 flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-slate-900 p-4 text-left transition hover:border-brand-500 hover:shadow-md disabled:opacity-70 dark:border-slate-700"
            >
              <span className="font-mono text-xs text-slate-400">$</span>
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-slate-100 sm:text-sm">
                {hasPat ? installCommand.replace(/(sh -s -- \S+\s+)(\S+)/, '$1•••••••• (token embedded)') : installCommand}
              </code>
              <span
                className={
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
                  (copied
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-slate-900 group-hover:bg-brand-500 group-hover:text-white')
                }
              >
                {minting ? 'Minting…' : copied ? '✓ Copied!' : 'Copy'}
              </span>
            </button>

            {error && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Mints a 1-year token tied to your account — no manual paste
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Auto-starts on login via launchd
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Takes ~10 seconds end-to-end
              </span>
            </div>

            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                Or do it manually →
              </summary>
              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <p>
                  <button
                    onClick={downloadManually}
                    className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
                  >
                    Download the bundle (13 KB)
                  </button>{' '}
                  and run:
                </p>
                <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">{`tar -xzf tokenboard-macos-widget.tar.gz
cd menubar
./build.sh install`}</pre>
              </div>
            </details>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          What you get
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon="📊"
            title="Today's count in the bar"
            body="Compact format like 1.7B or 203M. Resets at local midnight."
          />
          <FeatureCard
            icon="🪟"
            title="Popover summary"
            body="Today / 7-Day / 30-Day / Total stat cards plus per-source totals and top models."
          />
          <FeatureCard
            icon="🔄"
            title="Auto refresh"
            body="Polls /api/v1/usage/summary every 5 minutes. Click ↻ to force-refresh."
          />
          <FeatureCard
            icon="🔐"
            title="Local token storage"
            body="0600-mode file under ~/Library/Application Support/TokenBoard/. No keychain prompts."
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Requirements
        </h2>
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <li>• macOS 13 (Ventura) or newer — Apple Silicon or Intel</li>
          <li>
            • Xcode Command Line Tools — install with{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              xcode-select --install
            </code>
          </li>
          <li>• Network access to this server URL</li>
          <li>• An access token (paste in the bar's Settings after install)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Uninstall
        </h2>
        <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-700">
          ~/Library/Application\ Support/TokenBoard/build.sh uninstall
        </pre>
      </section>
    </div>
  );
}

function PreviewCard({ today, sevenDay }: { today?: string; sevenDay?: string }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 p-8 dark:from-slate-800 dark:to-slate-900 sm:p-12">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-slate-300/50 dark:bg-slate-950 dark:shadow-black/50">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today
            </div>
            <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {today === undefined ? '…' : formatTokensCompact(today)}
            </div>
            <div className="mt-1 text-xs text-slate-400 tabular-nums">
              {today === undefined ? '' : formatTokens(today)}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              7 Days
            </div>
            <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {sevenDay === undefined ? '…' : formatTokensCompact(sevenDay)}
            </div>
            <div className="mt-1 text-xs text-slate-400 tabular-nums">
              {sevenDay === undefined ? '' : formatTokens(sevenDay)}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Sparkline />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        This is what the popover looks like — pinned to your menu bar, refreshed every 5 minutes.
      </p>
    </div>
  );
}

function Sparkline() {
  const path = 'M0,30 C30,28 50,22 70,18 S110,12 140,10 S180,14 210,8 S250,6 280,4';
  return (
    <svg viewBox="0 0 280 40" className="h-12 w-full">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L280,40 L0,40 Z`} fill="url(#spark-grad)" />
      <path
        d={path}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{body}</p>
        </div>
      </div>
    </div>
  );
}

function TerminalIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm3.3 3.3a1 1 0 011.4 0l3 3a1 1 0 010 1.4l-3 3a1 1 0 11-1.4-1.4L7.6 11 5.3 8.7a1 1 0 010-1.4zM10 14a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z"
        />
      </svg>
    </span>
  );
}
