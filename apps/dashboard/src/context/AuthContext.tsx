import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  config: { oidc_enabled: boolean; password_signup: boolean } | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  startOidc: () => void;
  /** Returns the current access token. Null while signed out. */
  getAccessToken: () => string | null;
  /** Force a refresh — used after OIDC redirect populates the URL hash. */
  bootstrap: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

function readHashAccessToken(): string | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const t = params.get('access_token');
  if (t) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return t;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuthState['config']>(null);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
  }, []);

  const fetchMe = useCallback(async () => {
    if (!tokenRef.current) return null;
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { user: User };
    return json.user ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; user: User };
    setToken(json.access_token);
    setUser(json.user);
    return json.user;
  }, [setToken]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await fetch(`${API_BASE}/auth/config`);
      if (cfgRes.ok) setConfig(await cfgRes.json());

      const hashToken = readHashAccessToken();
      if (hashToken) {
        setToken(hashToken);
        const u = await fetchMe();
        if (u) setUser(u);
        else await refresh();
      } else {
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }, [refresh, fetchMe, setToken]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Sign in failed');
      }
      const json = (await res.json()) as { access_token: string; user: User };
      setToken(json.access_token);
      setUser(json.user);
    },
    [setToken],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Sign up failed');
      }
      const json = (await res.json()) as { access_token: string; user: User };
      setToken(json.access_token);
      setUser(json.user);
    },
    [setToken],
  );

  const signOut = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setToken(null);
    setUser(null);
  }, [setToken]);

  const startOidc = useCallback(() => {
    window.location.assign(`${API_BASE}/auth/oidc/start`);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      config,
      signInWithPassword,
      signUp,
      signOut,
      startOidc,
      getAccessToken: () => tokenRef.current,
      bootstrap,
    }),
    [user, loading, error, config, signInWithPassword, signUp, signOut, startOidc, bootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
