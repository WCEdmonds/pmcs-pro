import { useSyncExternalStore } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import { isPinChangeRequired, onPinChangeRequired, signOut } from '../lib/api'
import { flag } from '../lib/people'
import { useUnits } from '../hooks/useUnits'
import { ChangePinForm } from './ChangePinForm'

/**
 * Blocks the whole dashboard while the user must replace an admin-issued
 * temporary PIN: on sign-in / start (GET /me must_change_pin=1) or whenever a
 * request answers 403 PIN_CHANGE_REQUIRED.
 */
export function PinChangeGate({ children }: { children: React.ReactNode }) {
  const { profile, loading, applyProfile, reload } = useUnits()
  const flagged = useSyncExternalStore(onPinChangeRequired, isPinChangeRequired, isPinChangeRequired)

  if (!profile && loading && !flagged) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-text-secondary font-display text-lg">Loading...</div>
      </div>
    )
  }

  if (!flagged && !flag(profile?.must_change_pin)) return <>{children}</>

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary p-4" data-testid="forced-pin-change">
      <main className="w-full max-w-md bg-bg-secondary border border-border rounded-xl p-8" aria-labelledby="forced-pin-title">
        <div className="flex items-center gap-3 mb-2">
          <KeyRound className="w-6 h-6 text-accent-amber" />
          <h1 id="forced-pin-title" className="font-display text-xl font-bold text-text-primary">Set a new PIN</h1>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Your PIN was reset by an admin. Enter the temporary PIN you were given, then choose your own PIN. You can't use
          the dashboard until this is done.
        </p>
        <ChangePinForm
          idPrefix="forced-pin"
          currentLabel="Temporary PIN"
          submitLabel="Set new PIN"
          onChanged={(p) => {
            applyProfile({ ...p, must_change_pin: 0 })
            reload()
          }}
        />
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 flex items-center gap-2 text-sm text-text-secondary hover:text-accent-red"
        >
          <LogOut className="w-4 h-4" />
          Sign out instead
        </button>
      </main>
    </div>
  )
}
