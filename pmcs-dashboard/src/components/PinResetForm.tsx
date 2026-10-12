import { useRef, useState } from 'react'
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react'
import { confirmPinReset, errorMessage, isAbortedError, needsNewCode, requestPinReset } from '../lib/api'
import { newPinError } from '../lib/people'

const DOD_ID_RE = /^\d{10}$/

const inputCls =
  'w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm'
const labelCls = 'block text-sm font-medium text-text-secondary mb-1.5'
const submitCls =
  'w-full py-3 bg-accent-green text-bg-primary font-semibold rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2'
const linkCls = 'text-sm text-accent-blue hover:underline disabled:opacity-50'

export const PIN_RESET_SENT_MESSAGE =
  "If this account has a confirmed email, we sent a 6-digit code. It expires in 15 minutes. No email? Ask your unit's PMCS Pro admin to reset your PIN."

const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max)

interface PinResetFormProps {
  /** DoD ID already typed on the sign-in form. */
  initialDodId?: string
  /** Back to the sign-in form. */
  onCancel: () => void
  /** Called after the new PIN is set and the session stored. */
  onDone: () => void
}

/**
 * "Forgot PIN": DoD ID -> emailed 6-digit code -> code + new PIN. On success the
 * session is stored exactly like a normal sign-in.
 */
export function PinResetForm({ initialDodId = '', onCancel, onDone }: PinResetFormProps) {
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [dodId, setDodId] = useState(() => digits(initialDodId.trim(), 10))
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState('')
  const [offerNewCode, setOfferNewCode] = useState(false)
  const [resent, setResent] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await fn()
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function sendCode(again: boolean) {
    setError('')
    setOfferNewCode(false)
    setResent(false)
    const id = dodId.trim()
    if (!DOD_ID_RE.test(id)) {
      setError('DOD ID must be exactly 10 digits')
      return
    }
    await run(async () => {
      try {
        await requestPinReset(id)
        setCode('')
        setStep('confirm')
        setResent(again)
      } catch (err) {
        if (!isAbortedError(err)) setError(errorMessage(err))
      }
    })
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOfferNewCode(false)
    setResent(false)
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email')
      return
    }
    const invalid = newPinError('', pin, pinConfirm)
    if (invalid) {
      setError(invalid)
      return
    }
    await run(async () => {
      try {
        await confirmPinReset(dodId.trim(), code, pin)
      } catch (err) {
        if (isAbortedError(err)) return
        setError(errorMessage(err))
        setOfferNewCode(needsNewCode(err))
        return
      }
      onDone()
    })
  }

  return (
    <div className="space-y-4" data-testid="pin-reset">
      <div>
        <h2 className="font-display text-lg font-semibold text-text-primary">Reset your PIN</h2>
        {step === 'request' && (
          <p className="text-sm text-text-secondary mt-1">
            Enter your DOD ID. If your account has a confirmed email, we'll send a 6-digit code to it.
          </p>
        )}
      </div>

      {step === 'request' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void sendCode(false)
          }}
          noValidate
          className="space-y-4"
        >
          <div>
            <label htmlFor="reset-dodId" className={labelCls}>DOD ID</label>
            <input id="reset-dodId" type="text" inputMode="numeric" autoComplete="username" value={dodId} maxLength={10}
              onChange={(e) => setDodId(digits(e.target.value, 10))} placeholder="10-digit DOD ID" className={inputCls} />
          </div>
          {error && <p role="alert" className="text-accent-red text-sm text-center">{error}</p>}
          <button type="submit" disabled={busy} className={submitCls}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} noValidate className="space-y-4">
          <p role="status" className="text-sm text-text-secondary bg-bg-tertiary rounded-lg px-4 py-3">
            {resent && <span className="block text-accent-green mb-1">A new code was requested.</span>}
            {PIN_RESET_SENT_MESSAGE}
          </p>
          <div>
            <label htmlFor="reset-code" className={labelCls}>6-digit code</label>
            <input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6}
              onChange={(e) => setCode(digits(e.target.value, 6))} placeholder="123456" className={`${inputCls} tracking-widest`} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="reset-pin" className={labelCls}>New PIN</label>
              <input id="reset-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} maxLength={12}
                onChange={(e) => setPin(digits(e.target.value, 12))} placeholder="6-12 digits" className={inputCls} />
            </div>
            <div className="flex-1">
              <label htmlFor="reset-pin2" className={labelCls}>Confirm PIN</label>
              <input id="reset-pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pinConfirm} maxLength={12}
                onChange={(e) => setPinConfirm(digits(e.target.value, 12))} placeholder="Re-enter" className={inputCls} />
            </div>
          </div>
          {error && <p role="alert" className="text-accent-red text-sm text-center">{error}</p>}
          <button type="submit" disabled={busy} className={submitCls}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Set new PIN and sign in
          </button>
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={busy} onClick={() => void sendCode(true)}
              className={offerNewCode ? 'text-sm font-semibold text-accent-amber hover:underline disabled:opacity-50' : linkCls}>
              Send a new code
            </button>
            <button type="button" disabled={busy} className={linkCls}
              onClick={() => {
                setStep('request')
                setError('')
                setOfferNewCode(false)
                setResent(false)
              }}>
              Use a different DOD ID
            </button>
          </div>
        </form>
      )}

      <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>
    </div>
  )
}
