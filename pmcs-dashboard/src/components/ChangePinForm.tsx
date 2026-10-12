import { useRef, useState } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { changePin, errorMessage, isAbortedError, type ApiProfile } from '../lib/api'
import { newPinError } from '../lib/people'

const inputCls =
  'w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue font-display'

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12)

interface ChangePinFormProps {
  /** Label for the current-PIN field ("Temporary PIN" on the forced screen). */
  currentLabel?: string
  submitLabel?: string
  onChanged: (profile: ApiProfile) => void
  idPrefix: string
}

/** Current PIN + new PIN (6-12 digits) + confirm. Stores the token the server returns. */
export function ChangePinForm({ currentLabel = 'Current PIN', submitLabel = 'Change PIN', onChanged, idPrefix }: ChangePinFormProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (savingRef.current) return
    setDone(false)
    if (!current) {
      setError(`Enter your ${currentLabel.toLowerCase()}`)
      return
    }
    const invalid = newPinError(current, next, confirm)
    if (invalid) {
      setError(invalid)
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const profile = await changePin(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setDone(true)
      onChanged(profile)
    } catch (err) {
      if (!isAbortedError(err)) setError(errorMessage(err))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3" data-testid={`${idPrefix}-form`}>
      <div>
        <label htmlFor={`${idPrefix}-current`} className="block text-xs text-text-secondary mb-1">{currentLabel}</label>
        <input id={`${idPrefix}-current`} type="password" inputMode="numeric" autoComplete="current-password" value={current}
          onChange={(e) => setCurrent(digits(e.target.value))} className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-new`} className="block text-xs text-text-secondary mb-1">New PIN (6-12 digits)</label>
          <input id={`${idPrefix}-new`} type="password" inputMode="numeric" autoComplete="new-password" value={next}
            onChange={(e) => setNext(digits(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-confirm`} className="block text-xs text-text-secondary mb-1">Confirm new PIN</label>
          <input id={`${idPrefix}-confirm`} type="password" inputMode="numeric" autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(digits(e.target.value))} className={inputCls} />
        </div>
      </div>
      {error && <p role="alert" className="text-accent-red text-sm">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-bg-primary rounded-lg text-sm font-semibold hover:bg-accent-green/90 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {submitLabel}
        </button>
        {done && <span role="status" className="text-sm text-accent-green">PIN changed</span>}
      </div>
    </form>
  )
}
