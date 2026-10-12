import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { type ReactNode, useEffect, useState, lazy, Suspense } from 'react';
import { useUserStore } from './stores/userStore';
import { useSessionStore } from './stores/sessionStore';
import { onAuthChange } from './utils/api';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/NotFound';
import { UpdateBanner } from './components/layout/UpdateBanner';
import { startSyncListener, syncAll } from './utils/syncEngine';

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

/** Signed-in users who open /login go home (checked once on entry, so sign-in can redirect itself). */
function GuestOnly({ children }: { children: ReactNode }) {
  const [signedInOnEntry] = useState(() => !!useUserStore.getState().user);
  if (signedInOnEntry) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const [ready, setReady] = useState(false);
  const dodId = useUserStore((s) => s.user?.dodId);

  useEffect(() => {
    // Restore the user from the stored token: /me online, Dexie cache offline. Only a 401 logs out.
    useUserStore.getState().restore().finally(() => setReady(true));

    const stopSync = startSyncListener();
    const unsubscribeAuth = onAuthChange((signedIn) => {
      if (!signedIn && useUserStore.getState().user) {
        useSessionStore.getState().clearSession();
        useUserStore.getState().logout();
      }
    });

    return () => {
      unsubscribeAuth();
      stopSync();
    };
  }, []);

  // App start and every sign-in: send everything this soldier hasn't sent yet.
  useEffect(() => {
    if (ready && dodId) syncAll({ force: true });
  }, [ready, dodId]);

  if (!ready) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/profile-setup" element={<GuestOnly><ProfileSetupPage /></GuestOnly>} />
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
