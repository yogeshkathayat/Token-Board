import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function AuthCallbackPage() {
  const { bootstrap } = useAuth();
  const nav = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Don't get stuck on "Signing in…" if bootstrap rejects — fall back to login.
    void bootstrap()
      .then(() => nav('/dashboard', { replace: true }))
      .catch(() => setFailed(true));
  }, [bootstrap, nav]);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <p>Sign-in failed. Please try again.</p>
        <button
          type="button"
          onClick={() => nav('/login', { replace: true })}
          className="rounded-md border border-current px-3 py-1 text-sm"
        >
          Back to login
        </button>
      </div>
    );
  }

  return <div className="flex h-full items-center justify-center text-slate-500">Signing in…</div>;
}
