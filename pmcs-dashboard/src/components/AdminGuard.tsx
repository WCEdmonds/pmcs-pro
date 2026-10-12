import { NavLink, Outlet } from 'react-router-dom'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useUnits } from '../hooks/useUnits'
import { ErrorState } from './Feedback'

const tabs = [
  { to: 'users', label: 'Users' },
  { to: 'units', label: 'Unit settings' },
  { to: 'audit', label: 'Audit log' },
]

/** Admin area shell: only for profile.role === 'admin'; everyone else gets a 403 message. */
export function AdminGuard() {
  const { profile, loading, error, reload, isAdmin } = useUnits()

  if (loading) return <div className="text-text-secondary">Loading...</div>
  if (!profile) return <ErrorState title="Couldn't load your profile" message={error ?? 'Unknown error'} onRetry={reload} />
  if (!isAdmin) {
    return (
      <div role="alert" className="bg-bg-secondary border border-accent-red/40 rounded-xl p-8 max-w-xl" data-testid="admin-forbidden">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="w-6 h-6 text-accent-red" />
          <h1 className="font-display text-lg font-semibold text-text-primary">403: Admins only</h1>
        </div>
        <p className="text-sm text-text-secondary">
          You don't have access to the admin area. Ask an existing admin to make you an admin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-accent-green" />
          <h1 className="font-display text-2xl font-bold text-text-primary">Admin</h1>
        </div>
        <nav aria-label="Admin sections" className="flex gap-2 mt-4 border-b border-border">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }: { isActive: boolean }) =>
                `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive ? 'border-accent-green text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
