import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LimitsPage } from './pages/LimitsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DevicesPage } from './pages/DevicesPage';
import { WidgetsPage } from './pages/WidgetsPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

export function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading && location.pathname !== '/auth/callback') {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" state={{ from: location }} replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/limits" element={<LimitsPage />} />
        <Route path="/widgets" element={<WidgetsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/devices" element={<DevicesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
