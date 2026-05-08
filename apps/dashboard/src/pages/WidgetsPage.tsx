import { useState } from 'react';

import { useApi } from '../hooks/useApi';
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

  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  function downloadWidget() {
    setDownloading(true);
    // Public asset bundled at build time. Direct download via <a> with download attr.
    const a = document.createElement('a');
    a.href = '/macos-widget.tar.gz';
    a.download = 'tokenboard-macos-widget.tar.gz';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 800);
  }

  async function copyInstall() {
    const cmd = `curl -fsSL ${window.location.origin}/macos-widget.tar.gz | tar -xzf - && cd menubar && ./build.sh install`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
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
        <button
          onClick={downloadWidget}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:shadow-black/40 dark:hover:bg-white"
        >
          <DownloadIcon />
          {downloading ? 'Downloading…' : 'Download Mac App'}
        </button>
      </header>

      <section>
        <PreviewCard
          today={today.data?.totals.total_tokens}
          sevenDay={sevenDay.data?.totals.total_tokens}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Install
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ol className="space-y-4 text-sm">
            <Step
              n={1}
              title="Download the bundle"
              body={
                <>
                  Click <strong>Download Mac App</strong> above. You'll get a small
                  tarball (≈ 13 KB) containing the Swift source and an installer
                  script. No code-signing fuss because you're building it yourself
                  on your Mac.
                </>
              }
            />
            <Step
              n={2}
              title="Extract and install"
              body={
                <div className="space-y-2">
                  <div>In Terminal, navigate to where the file landed (usually <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">~/Downloads</code>) and run:</div>
                  <CodeBlock onCopy={copyInstall} copied={copied}>
                    {`tar -xzf tokenboard-macos-widget.tar.gz
cd menubar
./build.sh install`}
                  </CodeBlock>
                  <p className="text-xs text-slate-500">
                    Builds with <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">swiftc</code> (ships with Xcode Command Line Tools), copies the binary to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">~/Library/Application Support/TokenBoard/</code>, and registers a launchd agent so it auto-starts on login.
                  </p>
                </div>
              }
            />
            <Step
              n={3}
              title="Connect it"
              body={
                <>
                  Click the new <span className="inline-flex items-center gap-1 align-middle"><BarIconInline /></span> icon in your menu bar → click the gear ⚙️ → paste your access token. Server URL is auto-filled from the CLI's config if you have one, otherwise enter it manually. The bar will start showing today's count within seconds.
                </>
              }
            />
          </ol>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Also included
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon="📊"
            title="Today's count in the bar"
            body="Compact format — `1.7B`, `203M` — resets at local midnight."
          />
          <FeatureCard
            icon="🪟"
            title="Popover summary"
            body="Today / 7-Day / 30-Day / Total stat cards, plus per-source totals and top models."
          />
          <FeatureCard
            icon="🔄"
            title="Auto refresh"
            body="Polls /api/v1/usage/summary every 5 minutes. Click the ↻ to force-refresh."
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
          <li>• Xcode Command Line Tools (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">xcode-select --install</code>)</li>
          <li>• Connection to this server URL</li>
          <li>• An access token (paste in Settings; same one you'd use for the dashboard API)</li>
        </ul>
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
  // Smooth synthetic curve (just for the preview card — real chart uses /usage/daily).
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
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
        {n}
      </span>
      <div className="flex-1 pt-0.5">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="mt-1 text-slate-600 dark:text-slate-300">{body}</div>
      </div>
    </li>
  );
}

function CodeBlock({
  children,
  onCopy,
  copied,
}: {
  children: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-slate-900 dark:border dark:border-slate-700">
      <button
        onClick={onCopy}
        className="absolute right-2 top-2 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 opacity-80 transition hover:opacity-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 font-mono text-xs leading-relaxed text-slate-100">
        {children}
      </pre>
    </div>
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
    </svg>
  );
}

function BarIconInline() {
  return (
    <svg viewBox="0 0 18 14" className="h-3.5 w-4 text-slate-700 dark:text-slate-200" fill="currentColor">
      <rect x="1" y="8" width="3" height="6" rx="1" />
      <rect x="6" y="4" width="3" height="10" rx="1" />
      <rect x="11" y="0" width="3" height="14" rx="1" />
    </svg>
  );
}
