/**
 * Thin REST client. Reads the access token from AuthContext via a getter, and
 * on a 401 calls the supplied refresh hook once and retries — so a session
 * whose 1-hour access token expired mid-use recovers silently instead of
 * leaving the page broken until a manual reload.
 */
export interface ApiOptions {
  method?: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export type AccessTokenGetter = () => string | null;
/** Attempts to refresh the session; resolves to a fresh access token or null. */
export type RefreshFn = () => Promise<string | null>;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export class ApiClient {
  constructor(
    private getToken: AccessTokenGetter,
    private onAuthFailure?: RefreshFn,
  ) {}

  async request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const url = new URL(API_BASE + path, window.location.origin);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }

    const doFetch = (token: string | null) =>
      fetch(url.toString(), {
        method: opts.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });

    let res = await doFetch(this.getToken());

    // Access token likely expired — refresh once and retry. Skip for the auth
    // endpoints themselves to avoid a refresh loop.
    if (res.status === 401 && this.onAuthFailure && !path.startsWith('/auth/')) {
      const newToken = await this.onAuthFailure();
      if (newToken) res = await doFetch(newToken);
    }

    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (!res.ok) {
      const message = (json as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
      throw new ApiError(res.status, message, json);
    }
    return json as T;
  }
}
