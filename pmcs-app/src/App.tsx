import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { type ReactNode, useEffect, useState, lazy, Suspense, useRef } from 'react';
import { useUserStore } from './stores/userStore';
import { supabase } from './utils/supabase';
import { getSupabaseProfile } from './utils/auth';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { startSyncListener } from './utils/syncQueue';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const SessionSetupPage = lazy(() => import('./pages/SessionSetupPage'));
const PmcsWalkthroughPage = lazy(() => import('./pages/PmcsWalkthroughPage'));
const SummaryPage = lazy(() => import('./pages/SummaryPage'));
const Form5988Page = lazy(() => import('./pages/Form5988Page'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PriorFaultReviewPage = lazy(() => import('./pages/PriorFaultReviewPage'));

function AuthGuard({ children }: { children: ReactNode }) {
  const user = useUserStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const [ready, setReady] = useState(false);
  const setUser = useUserStore((s) => s.setUser);
  const syncCleanup = useRef<(() => void) | null>(null);

  // Restore session from Supabase auth (the only source of truth)
  useEffect(() => {
    const restore = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await getSupabaseProfile();
        if (profile) {
          setUser({
            dodId: profile.dod_id,
            rank: profile.rank ?? '',
            firstName: profile.first_name ?? '',
            lastName: profile.last_name ?? '',
            mi: profile.mi ?? '',
            unit: profile.unit ?? '',
          });
        }
      }
    };

    restore().finally(() => setReady(true));

    // Start sync queue listener (flushes pending syncs when coming online)
    syncCleanup.current = startSyncListener();

    // Listen for auth changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        useUserStore.getState().logout();
      }
    });

    return () => {
      subscription.unsubscribe();
      syncCleanup.current?.();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary font-display">Loading...</div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary font-display">Loading...</div>
      </div>
    }>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route path="/" element={<AuthGuard><AppLayout><HomePage /></AppLayout></AuthGuard>} />
        <Route path="/session/new" element={<AuthGuard><AppLayout><SessionSetupPage /></AppLayout></AuthGuard>} />
        <Route path="/session/:id/prior-faults" element={<AuthGuard><PriorFaultReviewPage /></AuthGuard>} />
        <Route path="/session/:id/pmcs" element={<AuthGuard><ErrorBoundary fallbackMessage="Inspection error — your data is saved"><PmcsWalkthroughPage /></ErrorBoundary></AuthGuard>} />
        <Route path="/session/:id/summary" element={<AuthGuard><SummaryPage /></AuthGuard>} />
        <Route path="/session/:id/5988" element={<AuthGuard><Form5988Page /></AuthGuard>} />
        <Route path="/history" element={<AuthGuard><AppLayout><HistoryPage /></AppLayout></AuthGuard>} />
        <Route path="/settings" element={<AuthGuard><AppLayout><SettingsPage /></AppLayout></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
