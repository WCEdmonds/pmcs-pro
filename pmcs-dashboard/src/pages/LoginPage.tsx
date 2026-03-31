import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
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

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: `${dodId}@id.pmcspro.app`,
      password: pin,
    })

    if (authError) {
      setError('Invalid DOD ID or PIN')
      setLoading(false)
      return
    }

    navigate('/')
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (pin !== pinConfirm) {
      setError('PINs do not match')
      return
    }
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }

    setLoading(true)

    // Use Edge Function to create user (bypasses email verification)
    const { data: signupData, error: signUpError } = await supabase.functions.invoke('signup', {
      body: { dod_id: dodId, pin, rank, first_name: firstName, last_name: lastName, mi: '', unit },
    })

    if (signUpError || signupData?.error) {
      setError(signupData?.error || signUpError?.message || 'Registration failed')
      setLoading(false)
      return
    }

    // Sign in after successful registration
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${dodId}@id.pmcspro.app`,
      password: pin,
    })

    if (signInError) {
      setError('Account created but login failed. Try signing in.')
      setLoading(false)
      setMode('login')
      return
    }

    navigate('/')
  }

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
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-accent-green text-bg-primary' : 'text-text-secondary'}`}
            >
              Sign In
            </button>
            <button
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
                <input id="dodId" type="text" inputMode="numeric" value={dodId} onChange={(e) => setDodId(e.target.value)} placeholder="Enter DOD ID" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                <input id="pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              {error && <p className="text-accent-red text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-accent-green text-bg-primary font-semibold rounded-lg hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">DOD ID</label>
                <input type="text" inputMode="numeric" value={dodId} onChange={(e) => setDodId(e.target.value)} placeholder="10-digit DOD ID" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Rank</label>
                  <input type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="CPT" required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Last Name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">UIC</label>
                <input type="text" value={unit} onChange={(e) => setUnit(e.target.value.toUpperCase())} placeholder="e.g., WABC12" required
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">PIN</label>
                  <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4-6 digits" required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm</label>
                  <input type="password" inputMode="numeric" value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value)} placeholder="Re-enter" required
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-green focus:border-transparent font-display text-sm" />
                </div>
              </div>
              {error && <p className="text-accent-red text-sm text-center">{error}</p>}
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
