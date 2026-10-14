import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { getSessionUserId, maybeRefreshSession, onAuthChange } from './lib/api'
import { UnitsProvider } from './components/UnitsProvider'
import { DashboardLayout } from './components/DashboardLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PinChangeGate } from './components/PinChangeGate'
import { AdminGuard } from './components/AdminGuard'

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const FleetOverview = lazy(() => import('./pages/FleetOverview').then(m => ({ default: m.FleetOverview })))
const VehicleDetail = lazy(() => import('./pages/VehicleDetail').then(m => ({ default: m.VehicleDetail })))
const FaultQueue = lazy(() => import('./pages/FaultQueue').then(m => ({ default: m.FaultQueue })))
const PmcsCompliance = lazy(() => import('./pages/PmcsCompliance').then(m => ({ default: m.PmcsCompliance })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const Review = lazy(() => import('./pages/Review').then(m => ({ default: m.Review })))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })))
const AdminUnitSettings = lazy(() => import('./pages/admin/AdminUnitSettings').then(m => ({ default: m.AdminUnitSettings })))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit').then(m => ({ default: m.AdminAudit })))

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(() => getSessionUserId())

  useEffect(() => onAuthChange(() => setUser(getSessionUserId())), [])

  // Sliding session: refresh a token older than ~1 day on start and when the tab returns.
  useEffect(() => {
    if (!user) return
    maybeRefreshSession()
    const onVisible = () => {
      if (document.visibilityState === 'visible') maybeRefreshSession()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Keyed by user so a different sign-in starts from fresh state.
  return (
    <UnitsProvider key={user}>
      <PinChangeGate>{children}</PinChangeGate>
    </UnitsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-bg-primary">
          <div className="text-text-secondary font-display text-lg">Loading...</div>
        </div>
      }>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<FleetOverview />} />
                    <Route path="/vehicle/:id" element={<VehicleDetail />} />
                    <Route path="/faults" element={<FaultQueue />} />
                    <Route path="/compliance" element={<PmcsCompliance />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/review" element={<Review />} />
                    <Route path="/admin" element={<AdminGuard />}>
                      <Route index element={<Navigate to="users" replace />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="units" element={<AdminUnitSettings />} />
                      <Route path="audit" element={<AdminAudit />} />
                      <Route path="*" element={<Navigate to="users" replace />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </DashboardLayout>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
