import { useEffect, useMemo, useState } from 'react';

import { ApiClient, type ApiOptions } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function useApiClient(): ApiClient {
  const { getAccessToken } = useAuth();
  return useMemo(() => new ApiClient(getAccessToken), [getAccessToken]);
}

export function useApi<T>(path: string | null, opts: ApiOptions = {}): {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
} {
  const client = useApiClient();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Stringify query for stable dep tracking.
  const queryKey = JSON.stringify(opts.query ?? {});

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    client
      .request<T>(path, { ...opts, signal: ctrl.signal })
      .then((res) => {
        if (!ctrl.signal.aborted) setData(res);
      })
      .catch((err: Error) => {
        if (ctrl.signal.aborted) return;
        setError(err);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, tick, client]);

  return { data, error, loading, refresh: () => setTick((t) => t + 1) };
}
