import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseSignIn, checkDodIdExists, getSupabaseProfile } from '../utils/auth';
import { useUserStore } from '../stores/userStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function LoginPage() {
  const [dodId, setDodId] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'dodid' | 'pin'>('dodid');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleDodIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dodId.trim()) return;
    setIsLoading(true);
    setError('');

    const exists = await checkDodIdExists(dodId.trim());
    setIsLoading(false);

    if (exists) {
      // Returning user — ask for PIN
      setStep('pin');
    } else {
      // New user — go straight to profile setup (where they'll create a PIN)
      navigate('/profile-setup', { state: { dodId: dodId.trim() } });
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setIsLoading(true);
    setError('');

    try {
      await supabaseSignIn(dodId.trim(), pin);
      const profile = await getSupabaseProfile();
      if (profile) {
        useUserStore.getState().setUser({
          dodId: profile.dod_id,
          rank: profile.rank ?? '',
          firstName: profile.first_name ?? '',
          lastName: profile.last_name ?? '',
          mi: profile.mi ?? '',
          unit: profile.unit ?? '',
        });
      }
      navigate('/');
    } catch {
      setError('Wrong PIN. Try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-4">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-display text-text-primary tracking-tight">
            PMCS PRO
          </h1>
          <p className="mt-2 text-text-secondary">
            Preventive Maintenance Checks & Services
          </p>
        </div>

        {step === 'dodid' ? (
          <form onSubmit={handleDodIdSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <Input
              label="DOD ID Number"
              value={dodId}
              onChange={(e) => setDodId(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter your 10-digit DOD ID"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-sm text-accent-red">{error}</p>}
          </form>
        ) : (
          <form onSubmit={handlePinSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <p className="text-text-secondary text-sm text-center">Welcome back. Enter your PIN.</p>
            <Input
              label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              type="password"
              placeholder="Enter your PIN"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-sm text-accent-red">{error}</p>}
            <button
              type="button"
              onClick={() => { setStep('dodid'); setPin(''); setError(''); }}
              className="text-accent-blue text-sm min-h-[44px]"
            >
              ← Different DOD ID
            </button>
          </form>
        )}
      </div>

      <div className="pb-[calc(16px+env(safe-area-inset-bottom))] flex flex-col gap-3 w-full max-w-sm mx-auto">
        <Button
          size="lg"
          fullWidth
          onClick={step === 'dodid' ? handleDodIdSubmit : handlePinSubmit}
          disabled={step === 'dodid' ? !dodId.trim() || isLoading : !pin || isLoading}
        >
          {isLoading ? 'Loading...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
