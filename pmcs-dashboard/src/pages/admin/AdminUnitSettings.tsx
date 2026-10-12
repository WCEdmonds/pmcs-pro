import { useRef, useState } from 'react'
import { Mail, Plus, Save, X, Loader2, Building2 } from 'lucide-react'
import { api, errorMessage, isAbortedError } from '../../lib/api'
import { useLoader } from '../../hooks/useLoader'
import { formatDateTime } from '../../lib/dates'
import { isValidEmail, MAX_UNIT_EMAILS } from '../../lib/people'
import { isValidUic, normalizeUic, uicError } from '../../lib/uic'
import { UicInput } from '../../components/UicInput'
import { ErrorState } from '../../components/Feedback'
import type { UnitSettings } from '../../types/database'

const inputCls =
  'w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue'

/** Splits pasted text ("a@x.mil, b@x.mil; c@x.mil") into trimmed addresses. */
function splitEmails(raw: string): string[] {
  return raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
}

function UnitEmailsEditor({ row, onSaved }: { row: UnitSettings; onSaved: () => void }) {
  const initial = row.notification_emails ?? []
  const [emails, setEmails] = useState<string[]>(initial)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saved, setSaved] = useState(false)
  // A newer server version (after Save) replaces the draft (the server may normalize addresses).
  const [version, setVersion] = useState(row.updated_at)
  if (version !== row.updated_at) {
    setVersion(row.updated_at)
    setEmails(initial)
  }
  const dirty = emails.join('\n') !== initial.join('\n')
  const inputId = `emails-${row.uic}`

  function add(): boolean {
    const parts = splitEmails(input)
    if (parts.length === 0) return true
    const bad = parts.filter((p) => !isValidEmail(p))
    if (bad.length) {
      setError(`Not a valid email address: ${bad.join(', ')}`)
      return false
    }
    const have = new Set(emails.map((e) => e.toLowerCase()))
    const next = [...emails]
    for (const p of parts) {
      if (!have.has(p.toLowerCase())) {
        have.add(p.toLowerCase())
        next.push(p)
      }
    }
    if (next.length > MAX_UNIT_EMAILS) {
      setError(`At most ${MAX_UNIT_EMAILS} addresses per unit`)
      return false
    }
    setEmails(next)
    setInput('')
    setError(null)
    setSaved(false)
    return true
  }

  async function save() {
    if (savingRef.current) return
    // Include an address still sitting in the input box.
    let list = emails
    if (input.trim()) {
      const parts = splitEmails(input)
      const bad = parts.filter((p) => !isValidEmail(p))
      if (bad.length) {
        setError(`Not a valid email address: ${bad.join(', ')}`)
        return
      }
      const have = new Set(emails.map((e) => e.toLowerCase()))
      list = [...emails, ...parts.filter((p) => !have.has(p.toLowerCase()))]
      if (list.length > MAX_UNIT_EMAILS) {
        setError(`At most ${MAX_UNIT_EMAILS} addresses per unit`)
        return
      }
      setEmails(list)
      setInput('')
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await api('PUT', `/admin/unit-settings/${encodeURIComponent(row.uic)}`, { body: { notification_emails: list } })
      setSaved(true)
      onSaved()
    } catch (err) {
      if (!isAbortedError(err)) setError(errorMessage(err))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4" data-testid={`unit-settings-${row.uic}`} aria-labelledby={`${inputId}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${inputId}-title`} className="font-display text-lg font-semibold text-text-primary">
          {row.uic}
          {row.unit_name && <span className="ml-2 text-sm font-normal text-text-secondary">{row.unit_name}</span>}
        </h2>
        <span className="text-xs text-text-secondary">{row.updated_at ? `Updated ${formatDateTime(row.updated_at)}` : 'Not set'}</span>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-text-secondary">No addresses: this unit uses the default notification address.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={`Notification emails for ${row.uic}`}>
          {emails.map((e) => (
            <li key={e} className="flex items-center gap-1 pl-3 pr-1 py-1 bg-bg-tertiary rounded-full text-sm text-text-primary">
              {e}
              <button
                type="button"
                onClick={() => {
                  setEmails((prev) => prev.filter((x) => x !== e))
                  setSaved(false)
                }}
                aria-label={`Remove ${e}`}
                className="p-1 rounded-full text-text-secondary hover:text-accent-red"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start gap-2">
        <label htmlFor={inputId} className="sr-only">Add email for {row.uic}</label>
        <input
          id={inputId}
          type="email"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="name@army.mil"
          aria-invalid={!!error}
          className={inputCls}
        />
        <button type="button" onClick={add} disabled={!input.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-bg-tertiary text-text-primary rounded-lg text-sm font-medium hover:bg-bg-tertiary/70 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {error && <p role="alert" className="text-accent-red text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving || (!dirty && !input.trim())}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-bg-primary rounded-lg text-sm font-semibold hover:bg-accent-green/90 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
        {dirty && !saving && <span className="text-xs text-accent-amber">Unsaved changes</span>}
        {saved && !dirty && <span role="status" className="text-sm text-accent-green">Saved</span>}
      </div>
    </section>
  )
}

export function AdminUnitSettings() {
  // Not polled: a background refresh must not wipe an admin's unsaved edits.
  const { data, error, loading, reload } = useLoader(
    'admin-unit-settings',
    (signal) => api<UnitSettings[]>('GET', '/admin/unit-settings', { signal }),
    { enabled: false },
  )
  const [extra, setExtra] = useState<string[]>([])
  const [newUic, setNewUic] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  function addUnit() {
    const uic = normalizeUic(newUic)
    const invalid = uicError(uic)
    if (invalid || !isValidUic(uic)) {
      setAddError(invalid ?? 'Enter a UIC')
      return
    }
    if (data?.some((r) => r.uic === uic) || extra.includes(uic)) {
      setAddError(`${uic} is already listed`)
      return
    }
    setExtra((prev) => [...prev, uic])
    setNewUic('')
    setAddError(null)
  }

  if (loading) return <p className="text-text-secondary">Loading unit settings...</p>
  if (!data) return <ErrorState title="Couldn't load unit settings" message={error ?? 'Unknown error'} onRetry={reload} />

  const listed = new Set(data.map((r) => r.uic))
  const rows: UnitSettings[] = [
    ...data,
    ...extra.filter((u) => !listed.has(u)).map((uic) => ({ uic, unit_name: null, notification_emails: [], updated_at: null })),
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3 text-sm text-text-secondary">
        <Mail className="w-5 h-5 mt-0.5 text-accent-blue flex-shrink-0" />
        <p>
          Who gets emailed for each unit: completed DA 2404s and new-member alerts. Up to {MAX_UNIT_EMAILS} addresses per unit. Units with no
          addresses set use the default notification address.
        </p>
      </div>

      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">Add a unit</h2>
        </div>
        <div className="flex items-start gap-2">
          <label htmlFor="add-unit-uic" className="sr-only">UIC</label>
          <UicInput id="add-unit-uic" value={newUic} onChange={(v) => { setNewUic(v); setAddError(null) }} onEnter={addUnit} className={`${inputCls} font-display`} />
          <button type="button" onClick={addUnit} disabled={!newUic.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add unit
          </button>
        </div>
        {addError && <p role="alert" className="text-accent-red text-sm mt-2">{addError}</p>}
      </div>

      {rows.length === 0 && <p className="text-text-secondary">No units yet.</p>}
      {rows.map((r) => (
        <UnitEmailsEditor key={r.uic} row={r} onSaved={reload} />
      ))}
    </div>
  )
}
