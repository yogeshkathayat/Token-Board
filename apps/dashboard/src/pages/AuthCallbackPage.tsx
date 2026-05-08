import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const { bootstrap } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    void bootstrap().then(() => nav('/dashboard', { replace: true }));
  }, [bootstrap, nav]);

  return <div className="flex h-full items-center justify-center text-slate-500">Signing in…</div>;
}
