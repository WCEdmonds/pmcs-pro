import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Shield, Loader2 } from 'lucide-react'
import { errorMessage, getSessionUserId, onAuthChange, signIn, signUp } from '../lib/api'
import { normalizeUic, uicError } from '../lib/uic'
import { UicInput } from '../components/UicInput'

const DOD_ID_RE = /^\d{10}$/
const PIN_RE = /^\d{6,12}$/

export function LoginPage() {
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(() => !!getSessionUserId())
  useEffect(() => onAuthChange(() => setSignedIn(!!getSessionUserId())), [])
  const [mi, setMi] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [dodId, setDodId] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [rank, setRank] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [unit, setUnit] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(dodId.trim(), pin)
    } catch (err) {
      // Shows the server's message, e.g. the 429 lockout notice
      setError(errorMessage(err) || 'Invalid DOD ID or PIN')
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitted(true)

    const id = dodId.trim()
    const uic = normalizeUic(unit)
    if (!DOD_ID_RE.test(id)) {
      setError('DOD ID must be exactly 10 digits')
      return
    }
    const uicErr = uicError(uic)
    if (uicErr) {
      setError(`UIC: ${uicErr}`)
      return
    }
    if (!PIN_RE.test(pin)) {
      setError('PIN must be 6 to 12 digits')
      return
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match')
      return
    }

    setLoading(true)

    try {
      await signUp(id, pin, {
        rank: rank.trim().toUpperCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mi: mi.trim().toUpperCase().slice(0, 1),
        unit: uic,
      })
    } catch (err) {
      setError(errorMessage(err) || 'Registration failed')
      setLoading(false)
      return
    }

    navigate('/', { replace: true })
  }

  if (signedIn) return <Navigate to="/" replace />

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-bg-secondary border border-border rounded-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <Shield className="w-12 h-12 text-accent-green mb-4" />
            <h1 className="font-display text-2xl font-bold text-text-primary">PMCS PRO</h1>
            <p className="text-sm text-text-secondary mt-1">Leader Dashboard</p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-bg-tertiary rounded-lg p-1 mb-6">
            <button type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-accent-green text-bg-primary' : 'text-text-secondary'}`}
            >
              Sign In
            </button>
            <button type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'register' ? 'bg-accent-green text-bg-primary' : 'text-text-secondary'}`}
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="dodId" className="block text-sm font-medium text-text-secondary mb-1.5">DOD ID</label>
                <input id="dodId" type="text" inputMode="numeric" autoComplete="username" value={dodId} onChange={(e) => setDodId(e.target.value)} placeholder="Enter DOD ID" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                <input id="pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              {error && <p role="alert" className="text-accent-red text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-accent-green text-bg-primary font-semibold rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate className="space-y-3">
              <div>
                <label htmlFor="reg-dodId" className="block text-sm font-medium text-text-secondary mb-1.5">DOD ID</label>
                <input id="reg-dodId" type="text" inputMode="numeric" autoComplete="username" value={dodId} onChange={(e) => setDodId(e.target.value.replace(/\D/g, ''))} placeholder="10-digit DOD ID" required maxLength={10} pattern="\d{10}" title="Exactly 10 digits"
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <label htmlFor="reg-rank" className="block text-sm font-medium text-text-secondary mb-1.5">Rank</label>
                  <input id="reg-rank" type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="CPT" required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
                <div className="flex-1">
                  <label htmlFor="reg-first" className="block text-sm font-medium text-text-secondary mb-1.5">First Name</label>
                  <input id="reg-first" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="reg-last" className="block text-sm font-medium text-text-secondary mb-1.5">Last Name</label>
                  <input id="reg-last" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
                <div className="w-16">
                  <label htmlFor="reg-mi" className="block text-sm font-medium text-text-secondary mb-1.5">MI</label>
                  <input id="reg-mi" type="text" value={mi} maxLength={1} onChange={(e) => setMi(e.target.value.toUpperCase())}
                    className="w-full px-3 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="reg-uic" className="block text-sm font-medium text-text-secondary mb-1.5">UIC</label>
                <UicInput id="reg-uic" value={unit} onChange={setUnit} placeholder="e.g., WABC12" showErrors={submitted}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="reg-pin" className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                  <input id="reg-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="6-12 digits" required minLength={6} maxLength={12}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
                </div>
                <div className="flex-1">
                  <label htmlFor="reg-pin2" className="block text-sm font-medium text-text-secondary mb-1.5">Confirm</label>
                  <input id="reg-pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))} maxLength={12} placeholder="Re-enter" required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
                </div>
              </div>
              {error && <p role="alert" className="text-accent-red text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-accent-green text-bg-primary font-semibold rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
