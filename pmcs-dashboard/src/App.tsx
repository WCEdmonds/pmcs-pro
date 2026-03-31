import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { DashboardLayout } from './components/DashboardLayout'

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const FleetOverview = lazy(() => import('./pages/FleetOverview').then(m => ({ default: m.FleetOverview })))
const VehicleDetail = lazy(() => import('./pages/VehicleDetail').then(m => ({ default: m.VehicleDetail })))
const FaultQueue = lazy(() => import('./pages/FaultQueue').then(m => ({ default: m.FaultQueue })))
const PmcsCompliance = lazy(() => import('./pages/PmcsCompliance').then(m => ({ default: m.PmcsCompliance })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-text-secondary font-display text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </DashboardLayout>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
