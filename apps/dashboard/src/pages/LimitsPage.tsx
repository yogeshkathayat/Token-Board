import { useApi } from '../hooks/useApi';

interface Sub {
  tool: string;
  provider: string;
  product: string;
  plan_type: string | null;
  rate_limit_tier: string | null;
  observed_at: string;
}

export function LimitsPage() {
  const { data, loading } = useApi<{ subscriptions: Sub[] }>('/usage/limits');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Usage limits</h1>
        <p className="text-sm text-slate-500">
          Subscription plans and rate-limit tiers reported by your installed AI tools.
        </p>
      </header>

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && data?.subscriptions.length === 0 && (
        <div className="card p-6 text-sm text-slate-500">
          No subscription data reported yet. Limits populate once your CLI has reported back to the server.
          Try <code>tokenboard sync</code>.
        </div>
      )}

      {data && data.subscriptions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.subscriptions.map((sub) => (
            <div key={`${sub.tool}-${sub.provider}-${sub.product}`} className="card p-4">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide">{sub.tool}</div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {sub.provider}
                </span>
              </div>
              <div className="mt-2 text-lg font-medium">{sub.plan_type ?? sub.product}</div>
              {sub.rate_limit_tier && (
                <div className="mt-1 text-xs text-slate-500">Tier: {sub.rate_limit_tier}</div>
              )}
              <div className="mt-3 text-xs text-slate-400">
                Observed {new Date(sub.observed_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
