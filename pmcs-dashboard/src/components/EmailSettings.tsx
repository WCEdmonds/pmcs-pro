import { useRef, useState } from 'react'
import { Loader2, Mail, Check, Send, Pencil, Trash2 } from 'lucide-react'
import { api, ApiError, errorMessage, isAbortedError, needsNewCode } from '../lib/api'
import { isValidEmail } from '../lib/people'
import { useUnits } from '../hooks/useUnits'
import { ConfirmDialog } from './Dialog'
import type { EmailUpdateResponse, Profile } from '../types/database'

const inputCls =
  'w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-accent-blue'
const btnPrimary =
  'flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 disabled:opacity-50 transition-colors whitespace-nowrap'
const btnSmall =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:text-text-primary disabled:opacity-50 transition-colors'

export const CODE_CAP_MESSAGE = 'No new code was sent: you can request 3 codes an hour. Try again later or use the last code you got.'

export function EmailBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent-green/20 text-accent-green">Confirmed</span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-accent-amber/20 text-accent-amber">Not confirmed</span>
  )
}

/** Settings → Email: personal email used for self-service PIN reset codes. */
export function EmailSettings({ profile }: { profile: Profile }) {
  const { applyProfile, reload } = useUnits()
  const email = profile.email ?? null
  const verified = !!email && !!profile.email_verified_at
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'save' | 'verify' | 'resend' | null>(null)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const showForm = !email || editing

  async function run(kind: 'save' | 'verify' | 'resend', fn: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (err) {
      if (!isAbortedError(err)) {
        const msg = errorMessage(err)
        setError(needsNewCode(err) ? `${msg} Use "Send a new code" below.` : msg)
      }
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  /** Keeps the shared profile in step with what the server returned. */
  function apply(p: Profile) {
    applyProfile({ ...p, email: p.email ?? null, email_verified_at: p.email_verified_at ?? null })
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const next = draft.trim().toLowerCase()
    if (!isValidEmail(next)) {
      setError('Enter a valid email address')
      return
    }
    void run('save', async () => {
      const { email_code_sent, ...p } = await api<EmailUpdateResponse>('PUT', '/me/email', { body: { email: next } })
      apply(p)
      setEditing(false)
      setDraft('')
      setCode('')
      if (p.email_verified_at) setNotice('Email saved.')
      else if (email_code_sent === false) setNotice(CODE_CAP_MESSAGE)
      else setNotice(`We sent a 6-digit code to ${p.email ?? next}. Enter it below to confirm. It expires in 15 minutes.`)
    })
  }

  function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email')
      return
    }
    void run('verify', async () => {
      const p = await api<Profile>('POST', '/me/email/verify', { body: { code } })
      apply(p)
      setCode('')
      setNotice('Email confirmed. You can now reset your own PIN from the sign-in page.')
    })
  }

  function resend() {
    void run('resend', async () => {
      try {
        await api('POST', '/me/email/resend')
      } catch (err) {
        // Already confirmed (e.g. in another tab): refresh instead of failing.
        if (err instanceof ApiError && err.status === 409) {
          reload()
          return
        }
        throw err
      }
      setCode('')
      setNotice(`We sent a new code to ${email}. It expires in 15 minutes.`)
    })
  }

  return (
    <div id="email" className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4 scroll-mt-8" data-testid="email-settings">
      <div className="flex items-center gap-3">
        <Mail className="w-5 h-5 text-accent-blue" />
        <h2 className="font-display text-lg font-semibold text-text-primary">Email</h2>
      </div>
      <p className="text-sm text-text-secondary">
        A personal email lets you reset your own PIN if you forget it ("Forgot PIN?" on the sign-in page). It's only used for PIN
        reset codes and security notices.
      </p>

      {email && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-bg-tertiary rounded-lg">
          <span className="text-sm text-text-primary break-all" data-testid="current-email">{email}</span>
          <EmailBadge verified={verified} />
          <div className="ml-auto flex gap-2">
            {!editing && (
              <button type="button" className={btnSmall} onClick={() => { setEditing(true); setDraft(email); setError(null); setNotice(null) }}>
                <Pencil className="w-3 h-3" /> Change
              </button>
            )}
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:text-accent-red disabled:opacity-50 transition-colors" onClick={() => setRemoving(true)}>
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} noValidate className="flex flex-wrap items-start gap-3">
          <label htmlFor="email-input" className="sr-only">Email address</label>
          <input id="email-input" type="email" autoComplete="email" value={draft} placeholder="you@example.com"
            onChange={(e) => { setDraft(e.target.value); setError(null) }} className={`${inputCls} flex-1 min-w-48`} />
          <button type="submit" disabled={!!busy} className={btnPrimary}>
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {email ? 'Save and send code' : 'Add email'}
          </button>
          {editing && (
            <button type="button" className={btnSmall + ' self-center'} onClick={() => { setEditing(false); setError(null) }}>
              Cancel
            </button>
          )}
        </form>
      )}

      {email && !verified && !editing && (
        <form onSubmit={verify} noValidate className="space-y-2" data-testid="email-verify">
          <p className="text-sm text-text-secondary">Enter the 6-digit code we emailed to confirm this address.</p>
          <div className="flex flex-wrap items-start gap-3">
            <label htmlFor="email-code" className="sr-only">Confirmation code</label>
            <input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              placeholder="6-digit code" onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
              className={`${inputCls} font-display tracking-widest w-40`} />
            <button type="submit" disabled={!!busy} className={btnPrimary}>
              {busy === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm
            </button>
            <button type="button" disabled={!!busy} onClick={resend} className={btnSmall + ' self-center'}>
              {busy === 'resend' && <Loader2 className="w-3 h-3 animate-spin" />}
              Send a new code
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-accent-red text-sm">{error}</p>}
      {notice && <p role="status" className="text-sm text-accent-green">{notice}</p>}

      {removing && (
        <ConfirmDialog
          title="Remove your email?"
          confirmLabel="Remove email"
          danger
          testId="confirm-remove-email"
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            const p = await api<Profile>('DELETE', '/me/email')
            apply(p)
            setRemoving(false)
            setEditing(false)
            setCode('')
            setError(null)
            setNotice('Email removed.')
          }}
        >
          <p>You won't be able to reset your own PIN. If you forget it, an admin will have to reset it for you.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
