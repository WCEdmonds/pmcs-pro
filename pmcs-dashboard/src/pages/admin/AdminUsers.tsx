import { useEffect, useState } from 'react'
import { Search, Users, KeyRound, LogOut, ShieldCheck, ShieldOff, ArrowRightLeft, Copy, Check, Lock } from 'lucide-react'
import { api } from '../../lib/api'
import { useLoader } from '../../hooks/useLoader'
import { PROFILE_CHANGED, useUnits } from '../../hooks/useUnits'
import { formatDateTime, formatDay, parseServerTime } from '../../lib/dates'
import { displayName, flag } from '../../lib/people'
import { isValidUic, normalizeUic } from '../../lib/uic'
import { UicInput } from '../../components/UicInput'
import { ConfirmDialog, Dialog, btnPrimary } from '../../components/Dialog'
import { ErrorState, StaleBanner } from '../../components/Feedback'
import type { AdminUser, UserRole } from '../../types/database'

const LIMIT = 200

const inputCls =
  'w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue'

const actionBtn =
  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-text-secondary bg-bg-tertiary hover:text-text-primary disabled:opacity-50 transition-colors whitespace-nowrap'

type Action = 'reset' | 'signout' | 'role' | 'move'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

function userLabel(u: AdminUser): string {
  return displayName(u) || (u.dod_last4 ? `DOD …${u.dod_last4}` : u.id)
}

function isLocked(u: Pick<AdminUser, 'locked_until'>, now = new Date()): boolean {
  const until = parseServerTime(u.locked_until)
  return !!until && until.getTime() > now.getTime()
}

function TempPinDialog({ user, pin, onClose }: { user: AdminUser; pin: string; onClose: () => void }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  async function copy() {
    try {
      await navigator.clipboard.writeText(pin)
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }
  return (
    <Dialog
      title={`Temporary PIN for ${userLabel(user)}`}
      onClose={onClose}
      testId="temp-pin-dialog"
      footer={
        <button type="button" onClick={onClose} className={btnPrimary}>
          Done
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <code className="flex-1 px-4 py-3 bg-bg-tertiary rounded-lg font-display text-2xl tracking-widest text-text-primary select-all" data-testid="temp-pin">
          {pin}
        </code>
        <button type="button" data-autofocus onClick={copy} className={actionBtn} aria-label="Copy temporary PIN">
          {copied === 'ok' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied === 'ok' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {copied === 'failed' && <p role="alert" className="text-accent-amber">Couldn't copy. Select the PIN and copy it by hand.</p>}
      <p className="text-text-primary font-medium">
        Give this to the soldier in person. They must set a new PIN on next sign-in.
      </p>
      <p>This PIN is shown only once. If you lose it, reset the PIN again.</p>
    </Dialog>
  )
}

function MoveUnitDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [unit, setUnit] = useState('')
  const uic = normalizeUic(unit)
  const valid = isValidUic(uic) && uic !== user.unit
  return (
    <ConfirmDialog
      title={`Move ${userLabel(user)} to another unit`}
      confirmLabel="Move"
      canConfirm={valid}
      testId="move-dialog"
      onClose={onClose}
      onConfirm={async () => {
        await api('PATCH', `/admin/users/${encodeURIComponent(user.id)}`, { body: { unit: uic } })
        onDone()
      }}
    >
      <p>
        They will leave <span className="font-display text-text-primary">{user.unit ?? '---'}</span> and only be able to update vehicles
        and faults in the new unit, and will see its vehicles instead.
      </p>
      <div>
        <label htmlFor="move-uic" className="block text-xs mb-1">New UIC</label>
        <UicInput id="move-uic" value={unit} onChange={setUnit} className={`${inputCls} font-display`} />
      </div>
      {uic && uic === user.unit && <p className="text-accent-amber">They are already in {uic}.</p>}
    </ConfirmDialog>
  )
}

export function AdminUsers() {
  const { profile } = useUnits()
  const [q, setQ] = useState('')
  const [unitInput, setUnitInput] = useState('')
  const query = useDebounced(q.trim(), 300)
  const unitNorm = normalizeUic(unitInput)
  const unit = isValidUic(unitNorm) ? unitNorm : ''
  const unitPending = !!unitNorm && !unit

  const key = `admin-users|${unit}|${query}`
  const { data, error, loading, updatedAt, reload } = useLoader(
    key,
    (signal) =>
      api<AdminUser[]>('GET', '/admin/users', { query: { unit: unit || undefined, q: query || undefined, limit: LIMIT }, signal }),
    { intervalMs: 60_000 },
  )

  const [pending, setPending] = useState<{ action: Action; user: AdminUser } | null>(null)
  const [tempPin, setTempPin] = useState<{ user: AdminUser; pin: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const close = () => setPending(null)
  const done = (msg: string) => {
    setPending(null)
    setNotice(msg)
    reload()
  }

  const now = new Date()
  const rows = data ?? []
  const isSelf = (u: AdminUser) => u.id === profile?.id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="relative w-72">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3" aria-hidden />
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <input
            id="user-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or last 4 of DOD ID"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="w-48">
          <label htmlFor="user-unit" className="sr-only">Filter by UIC</label>
          <UicInput id="user-unit" value={unitInput} onChange={setUnitInput} placeholder="Any unit (UIC)" className={`${inputCls} font-display`} />
          {unitPending && <p className="text-xs text-text-secondary mt-1">Unit filter applies once the UIC is 6 characters.</p>}
        </div>
      </div>

      {notice && (
        <p role="status" className="px-4 py-3 bg-accent-green/10 border border-accent-green/40 rounded-lg text-sm text-text-primary">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-text-secondary">Loading users...</p>
      ) : !data ? (
        <ErrorState title="Couldn't load users" message={error ?? 'Unknown error'} onRetry={reload} />
      ) : (
        <>
          {error && <StaleBanner message={error} updatedAt={updatedAt} onRetry={reload} />}
          <div className="bg-bg-secondary border border-border rounded-xl">
            <div className="flex items-center gap-3 p-6 border-b border-border">
              <Users className="w-5 h-5 text-text-secondary" />
              <h2 className="font-display text-lg font-semibold text-text-primary">Users</h2>
              <span className="text-sm text-text-secondary">({rows.length}{rows.length >= LIMIT ? '+' : ''})</span>
            </div>
            {rows.length >= LIMIT && (
              <p className="px-6 pt-3 text-xs text-text-secondary">Showing the first {LIMIT}. Search or filter by unit to narrow the list.</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="users-table">
                <thead>
                  <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">DOD ID</th>
                    <th className="px-6 py-3">Unit</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Joined</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((u) => {
                    const locked = isLocked(u, now)
                    const mustChange = flag(u.must_change_pin)
                    return (
                      <tr key={u.id} data-testid={`user-row-${u.id}`}>
                        <td className="px-6 py-3 text-sm text-text-primary">
                          {displayName(u) || '---'}
                          {isSelf(u) && <span className="ml-2 text-xs text-text-secondary">(you)</span>}
                        </td>
                        <td className="px-6 py-3 text-sm font-display text-text-secondary">{u.dod_last4 ? `…${u.dod_last4}` : '---'}</td>
                        <td className="px-6 py-3 text-sm font-display text-text-secondary">{u.unit ?? '---'}</td>
                        <td className="px-6 py-3 text-sm">
                          {u.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent-green/20 text-accent-green">Admin</span>
                          ) : (
                            <span className="text-text-secondary">Member</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs space-y-1">
                          {locked && (
                            <span className="flex items-center gap-1 text-accent-red" title="Too many wrong PIN attempts">
                              <Lock className="w-3 h-3" /> Locked until {formatDateTime(u.locked_until)}
                            </span>
                          )}
                          {mustChange && <span className="block text-accent-amber">Must change PIN</span>}
                          {!locked && !mustChange && <span className="text-text-secondary">Active</span>}
                        </td>
                        <td className="px-6 py-3 text-sm text-text-secondary">{formatDay(u.created_at)}</td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" className={actionBtn} onClick={() => setPending({ action: 'reset', user: u })}>
                              <KeyRound className="w-3 h-3" /> Reset PIN
                            </button>
                            <button type="button" className={actionBtn} onClick={() => setPending({ action: 'signout', user: u })}>
                              <LogOut className="w-3 h-3" /> Sign out everywhere
                            </button>
                            <button type="button" className={actionBtn} onClick={() => setPending({ action: 'role', user: u })}>
                              {u.role === 'admin' ? <ShieldOff className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                              {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            </button>
                            <button type="button" className={actionBtn} onClick={() => setPending({ action: 'move', user: u })}>
                              <ArrowRightLeft className="w-3 h-3" /> Move unit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">No users match</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pending?.action === 'reset' && (
        <ConfirmDialog
          title={`Reset PIN for ${userLabel(pending.user)}?`}
          confirmLabel="Reset PIN"
          danger
          testId="confirm-reset"
          onClose={close}
          onConfirm={async () => {
            const { temp_pin } = await api<{ temp_pin: string }>('POST', `/admin/users/${encodeURIComponent(pending.user.id)}/reset-pin`)
            setPending(null)
            setNotice(null)
            setTempPin({ user: pending.user, pin: temp_pin })
            reload()
          }}
        >
          <p>
            Their current PIN stops working immediately, they are signed out on every device, and any wrong-PIN lock is cleared. You'll
            get a one-time temporary PIN to hand to them in person; they must set a new PIN the next time they sign in.
          </p>
        </ConfirmDialog>
      )}

      {pending?.action === 'signout' && (
        <ConfirmDialog
          title={`Sign ${userLabel(pending.user)} out everywhere?`}
          confirmLabel="Sign out everywhere"
          danger
          testId="confirm-signout"
          onClose={close}
          onConfirm={async () => {
            await api('POST', `/admin/users/${encodeURIComponent(pending.user.id)}/sign-out-everywhere`)
            done(`${userLabel(pending.user)} was signed out on all devices.`)
          }}
        >
          <p>Every session on every phone and browser ends. They must sign in again with their PIN.</p>
          {isSelf(pending.user) && <p className="text-accent-amber">This is you: you will be signed out of this dashboard too.</p>}
        </ConfirmDialog>
      )}

      {pending?.action === 'role' && (() => {
        const u = pending.user
        const next: UserRole = u.role === 'admin' ? 'member' : 'admin'
        return (
          <ConfirmDialog
            title={next === 'admin' ? `Make ${userLabel(u)} an admin?` : `Remove admin from ${userLabel(u)}?`}
            confirmLabel={next === 'admin' ? 'Make admin' : 'Remove admin'}
            danger={next === 'member'}
            testId="confirm-role"
            onClose={close}
            onConfirm={async () => {
              await api('POST', `/admin/users/${encodeURIComponent(u.id)}/role`, { body: { role: next } })
              done(next === 'admin' ? `${userLabel(u)} is now an admin.` : `${userLabel(u)} is no longer an admin.`)
              if (isSelf(u)) window.dispatchEvent(new Event(PROFILE_CHANGED))
            }}
          >
            {next === 'admin' ? (
              <p>They will be able to reset anyone's PIN, sign anyone out, change roles, move users between units, edit unit notification emails and read the audit log, for every unit.</p>
            ) : (
              <p>They lose access to the admin area. The last remaining admin can't be removed.</p>
            )}
            {isSelf(u) && next === 'member' && <p className="text-accent-amber">This is you: you will lose access to this page.</p>}
          </ConfirmDialog>
        )
      })()}

      {pending?.action === 'move' && (
        <MoveUnitDialog
          user={pending.user}
          onClose={close}
          onDone={() => {
            done(`${userLabel(pending.user)} was moved to another unit.`)
            if (isSelf(pending.user)) window.dispatchEvent(new Event(PROFILE_CHANGED))
          }}
        />
      )}

      {tempPin && <TempPinDialog user={tempPin.user} pin={tempPin.pin} onClose={() => setTempPin(null)} />}
    </div>
  )
}
