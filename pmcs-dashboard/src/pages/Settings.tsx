import { useEffect, useState } from 'react'
import { Plus, X, Loader2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface WatchedUic {
  id: string
  uic: string
}

export function Settings() {
  const [watchedUics, setWatchedUics] = useState<WatchedUic[]>([])
  const [ownUic, setOwnUic] = useState<string | null>(null)
  const [newUic, setNewUic] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const profileRes = await supabase.from('profiles').select('unit').eq('id', user.id).single()
    const watchedRes = await supabase.from('dashboard_watched_uics').select('id, uic').eq('user_id', user.id).order('created_at', { ascending: true })

    setOwnUic((profileRes.data as { unit: string | null } | null)?.unit ?? null)
    setWatchedUics((watchedRes.data ?? []) as WatchedUic[])
    setLoading(false)
  }

  async function handleAdd() {
    const uic = newUic.trim().toUpperCase()
    if (!uic) return

    if (uic === ownUic) {
      setError('This is already your assigned UIC')
      return
    }
    if (watchedUics.some((w) => w.uic === uic)) {
      setError('UIC already in your watch list')
      return
    }

    setAdding(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error: insertError } = await supabase
      .from('dashboard_watched_uics')
      .insert({ user_id: user.id, uic } as never)
      .select('id, uic')
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setWatchedUics((prev) => [...prev, data as WatchedUic])
      setNewUic('')
      window.dispatchEvent(new Event('watched-uics-changed'))
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    await supabase.from('dashboard_watched_uics').delete().eq('id', id)
    setWatchedUics((prev) => prev.filter((w) => w.id !== id))
    window.dispatchEvent(new Event('watched-uics-changed'))
    setRemovingId(null)
  }

  if (loading) {
    return <div className="text-text-secondary">Loading settings...</div>
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Configure your dashboard view</p>
      </div>

      {/* Own UIC */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">Your UIC</h2>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-bg-tertiary border border-border rounded-lg font-display font-semibold text-text-primary">
            {ownUic ?? 'Not set'}
          </span>
          <span className="text-xs text-text-secondary">Assigned from your profile</span>
        </div>
      </div>

      {/* Watched UICs */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="w-5 h-5 text-accent-blue" />
          <h2 className="font-display text-lg font-semibold text-text-primary">Watched UICs</h2>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Add UICs to see their vehicles, faults, and inspections alongside your own unit's data.
        </p>

        {/* Add UIC form */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={newUic}
            onChange={(e) => {
              setNewUic(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter UIC (e.g. WABC12)"
            className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue font-display uppercase"
            maxLength={6}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newUic.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>

        {error && (
          <p className="text-accent-red text-sm mb-4">{error}</p>
        )}

        {/* List */}
        {watchedUics.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">
            No additional UICs being watched
          </p>
        ) : (
          <div className="space-y-2">
            {watchedUics.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between px-4 py-3 bg-bg-tertiary rounded-lg"
              >
                <span className="font-display font-semibold text-text-primary">{w.uic}</span>
                <button
                  onClick={() => handleRemove(w.id)}
                  disabled={removingId === w.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-text-secondary hover:text-accent-red hover:bg-accent-red/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {removingId === w.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
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
