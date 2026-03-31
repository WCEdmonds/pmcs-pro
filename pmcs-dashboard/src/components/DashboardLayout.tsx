import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, AlertTriangle, ClipboardCheck, LogOut, Shield, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Fleet Overview' },
  { to: '/faults', icon: AlertTriangle, label: 'Fault Queue' },
  { to: '/compliance', icon: ClipboardCheck, label: 'PMCS Compliance' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data)
      }
    }
    loadProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const displayName = profile
    ? `${profile.rank ?? ''} ${profile.last_name ?? ''}`.trim() || profile.dod_id
    : ''

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-accent-green" />
            <div>
              <h1 className="font-display text-lg font-bold text-text-primary leading-tight">
                PMCS PRO
              </h1>
              <p className="text-xs text-text-secondary">Leader Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-border">
          {displayName && (
            <p className="text-sm text-text-secondary mb-3 truncate">{displayName}</p>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 w-full rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary hover:text-accent-red transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
