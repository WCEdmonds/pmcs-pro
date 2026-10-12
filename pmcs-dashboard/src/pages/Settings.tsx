import { useRef, useState } from 'react'
import { Plus, X, Loader2, Eye, User, Save } from 'lucide-react'
import { api, errorMessage, isAbortedError } from '../lib/api'
import { useLoader } from '../hooks/useLoader'
import { PROFILE_CHANGED, unitLabel, useUnits, WATCHED_UICS_CHANGED } from '../hooks/useUnits'
import { normalizeUic, uicError } from '../lib/uic'
import { UicInput } from '../components/UicInput'
import { ActionError, ErrorState } from '../components/Feedback'
import type { Profile, ProfileUpdate, WatchedUic } from '../types/database'

const inputCls =
  'w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue'

function ProfileEditor({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    rank: profile.rank ?? '',
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    mi: profile.mi ?? '',
    unit: profile.unit ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSubmitted(true)
    const unit = normalizeUic(form.unit)
    const unitErr = uicError(unit)
    if (unitErr) {
      setError(`UIC: ${unitErr}`)
      return
    }
    const update: ProfileUpdate = {
      rank: form.rank.trim().toUpperCase(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      mi: form.mi.trim().toUpperCase().slice(0, 1),
      unit,
    }
    if (!update.rank || !update.first_name || !update.last_name) {
      setError('Rank, first name and last name are required')
      return
    }
    if (unit !== profile.unit && !window.confirm(`Change your unit to ${unit}? You will only be able to update faults for ${unit}.`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await api<Profile>('PATCH', '/me', { body: update })
      setForm({
        rank: next.rank ?? '',
        first_name: next.first_name ?? '',
        last_name: next.last_name ?? '',
        mi: next.mi ?? '',
        unit: next.unit ?? '',
      })
      setSaved(true)
      window.dispatchEvent(new Event(PROFILE_CHANGED))
    } catch (err) {
      if (!isAbortedError(err)) setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4" data-testid="profile-form">
      <div className="flex items-center gap-3">
        <User className="w-5 h-5 text-accent-green" />
        <h2 className="font-display text-lg font-semibold text-text-primary">Profile</h2>
      </div>
      <p className="text-sm text-text-secondary">
        DOD ID <span className="font-display text-text-primary">{profile.dod_id}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-xs text-text-secondary space-y-1">
          <span>Rank</span>
          <input className={inputCls} value={form.rank} onChange={(e) => set('rank')(e.target.value)} />
        </label>
        <label className="text-xs text-text-secondary space-y-1 sm:col-span-1">
          <span>First name</span>
          <input className={inputCls} value={form.first_name} onChange={(e) => set('first_name')(e.target.value)} />
        </label>
        <label className="text-xs text-text-secondary space-y-1">
          <span>MI</span>
          <input className={inputCls} value={form.mi} maxLength={1} onChange={(e) => set('mi')(e.target.value)} />
        </label>
        <label className="text-xs text-text-secondary space-y-1">
          <span>Last name</span>
          <input className={inputCls} value={form.last_name} onChange={(e) => set('last_name')(e.target.value)} />
        </label>
      </div>
      <div className="text-xs text-text-secondary space-y-1">
        <label htmlFor="profile-uic">Your UIC (own unit)</label>
        <UicInput id="profile-uic" value={form.unit} onChange={set('unit')} className={`${inputCls} font-display`} showErrors={submitted} />
      </div>
      {error && <p role="alert" className="text-accent-red text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-bg-primary rounded-lg text-sm font-semibold hover:bg-accent-green/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save profile
        </button>
        {saved && <span className="text-sm text-accent-green">Saved</span>}
      </div>
    </form>
  )
}

export function Settings() {
  const { profile, ownUnit, unitNames, loading: profileLoading, error: profileError, reload: reloadProfile } = useUnits()
  const watched = useLoader('watched-uics', (signal) => api<WatchedUic[]>('GET', '/watched-uics', { signal }), { enabled: false })
  const [newUic, setNewUic] = useState('')
  const [adding, setAdding] = useState(false)
  const addingRef = useRef(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (addingRef.current) return // Enter + click (or key repeat) must not double-submit
    const uic = normalizeUic(newUic)
    const invalid = uicError(uic)
    if (invalid) {
      setError(invalid)
      return
    }
    if (uic === ownUnit) {
      setError('This is already your own UIC')
      return
    }
    if (watched.data?.some((w) => w.uic === uic)) {
      setError('UIC already in your watch list')
      return
    }
    addingRef.current = true
    setAdding(true)
    setError(null)
    try {
      const row = await api<WatchedUic>('POST', '/watched-uics', { body: { uic } })
      watched.mutate((prev) => [...prev, row])
      setNewUic('')
      window.dispatchEvent(new Event(WATCHED_UICS_CHANGED))
    } catch (err) {
      if (!isAbortedError(err)) setError(errorMessage(err))
    } finally {
      addingRef.current = false
      setAdding(false)
    }
  }

  async function handleRemove(w: WatchedUic) {
    if (removingId) return
    setRemovingId(w.id)
    setError(null)
    try {
      await api('DELETE', `/watched-uics/${encodeURIComponent(w.id)}`)
      watched.mutate((prev) => prev.filter((x) => x.id !== w.id))
      window.dispatchEvent(new Event(WATCHED_UICS_CHANGED))
    } catch (err) {
      if (!isAbortedError(err)) setError(`Couldn't remove ${w.uic}: ${errorMessage(err)}`)
    } finally {
      setRemovingId(null)
    }
  }

  if (profileLoading) return <div className="text-text-secondary">Loading settings...</div>

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Your profile and the units you watch</p>
      </div>

      {profile ? (
        <ProfileEditor key={profile.id} profile={profile} />
      ) : (
        <ErrorState title="Couldn't load your profile" message={profileError ?? 'Unknown error'} onRetry={reloadProfile} />
      )}

      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5 text-accent-blue" />
          <h2 className="font-display text-lg font-semibold text-text-primary">Watched UICs</h2>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Add UICs to see their vehicles, faults and inspections alongside your own unit ({ownUnit ? unitLabel(ownUnit, unitNames) : 'not set'}).
          Watched units are view only.
        </p>

        <div className="flex items-start gap-3 mb-6">
          <UicInput
            id="watch-uic"
            value={newUic}
            onChange={(v) => {
              setNewUic(v)
              setError(null)
            }}
            onEnter={handleAdd}
            placeholder="Enter UIC (e.g. WABC12)"
            className={`${inputCls} font-display uppercase`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newUic.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>

        <div className="mb-4">
          <ActionError message={error} onDismiss={() => setError(null)} />
        </div>

        {watched.loading ? (
          <p className="text-sm text-text-secondary py-4 text-center">Loading watch list...</p>
        ) : !watched.data ? (
          <ErrorState title="Couldn't load your watch list" message={watched.error ?? 'Unknown error'} onRetry={watched.reload} />
        ) : watched.data.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">No additional UICs being watched</p>
        ) : (
          <div className="space-y-2" data-testid="watch-list">
            {watched.data.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-3 bg-bg-tertiary rounded-lg">
                <span className="font-display font-semibold text-text-primary">{unitLabel(w.uic, unitNames)}</span>
                <button
                  onClick={() => handleRemove(w)}
                  disabled={!!removingId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {removingId === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
