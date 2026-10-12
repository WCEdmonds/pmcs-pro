import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { remoteSignIn, checkDodIdExists } from '../utils/auth';
import { ApiError, getSignOutNotice, isNetworkError } from '../utils/api';
import { useUserStore } from '../stores/userStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

function loginErrorMessage(err: unknown): string {
  if (isNetworkError(err)) return "Can't reach the server. Check your connection and try again.";
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Wrong PIN. Try again.';
    return err.message || `Sign-in failed (${err.status})`;
  }
  return 'Sign-in failed. Try again.';
}

export default function LoginPage() {
  const [dodId, setDodId] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'dodid' | 'pin'>('dodid');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  // "You were signed out" after a session was revoked elsewhere or expired.
  const [notice] = useState(() => getSignOutNotice());
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const cleanDodId = dodId.replace(/\D/g, '');

  const handleDodIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!cleanDodId || busyRef.current) return;
    if (cleanDodId.length !== 10) {
      setError('DOD ID must be 10 digits.');
      return;
    }
    busyRef.current = true;
    setIsLoading(true);
    setError('');

    const result = await checkDodIdExists(cleanDodId);
    setIsLoading(false);
    busyRef.current = false;

    if (result.status === 'exists') {
      setStep('pin');
    } else if (result.status === 'new') {
      navigate('/profile-setup', { state: { dodId: cleanDodId } });
    } else {
      // Never send an existing user to signup just because we couldn't check.
      setError(result.message);
    }
  };

  const goToForgotPin = () => navigate('/forgot-pin', { state: { dodId: cleanDodId } });

  const handlePinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pin || busyRef.current) return;
    if (!/^\d{4,12}$/.test(pin)) {
      setError('PIN is 4 to 12 digits.');
      return;
    }
    busyRef.current = true;
    setIsLoading(true);
    setError('');

    try {
      const profile = await remoteSignIn(cleanDodId, pin);
      await useUserStore.getState().setFromProfile(profile);
      // Return to an inspection deep link (e.g. after the session expired); otherwise Home.
      navigate(from && from.startsWith('/session/') ? from : '/', { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setIsLoading(false);
    } finally {
      busyRef.current = false;
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

        {notice && (
          <p
            className="w-full max-w-sm text-sm text-text-primary bg-accent-amber/10 border border-accent-amber/40 rounded-[var(--radius-md)] p-3"
            role="status"
            data-testid="signout-notice"
          >
            {notice} Inspections saved on this phone are kept and will send after you sign in.
          </p>
        )}

        {step === 'dodid' ? (
          <form onSubmit={handleDodIdSubmit} noValidate className="w-full max-w-sm flex flex-col gap-4">
            <Input
              label="DOD ID Number"
              value={dodId}
              onChange={(e) => setDodId(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter your 10-digit DOD ID"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
            <button
              type="button"
              onClick={goToForgotPin}
              className="text-accent-blue text-sm min-h-[44px] self-start"
            >
              Forgot PIN?
            </button>
          </form>
        ) : (
          <form onSubmit={handlePinSubmit} className="w-full max-w-sm flex flex-col gap-4">
            <p className="text-text-secondary text-sm text-center">Welcome back. Enter your PIN.</p>
            <Input
              label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              inputMode="numeric"
              pattern="[0-9]*"
              type="password"
              placeholder="Enter your PIN"
              autoFocus
              autoComplete="off"
              aria-describedby="forgot-pin-note"
            />
            <p id="forgot-pin-note" className="text-xs text-text-secondary">
              Forgot your PIN? Reset it with a code sent to your confirmed email, or ask your unit's PMCS Pro admin to
              reset it. You'll get a temporary PIN.
            </p>
            {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
            <button
              type="button"
              onClick={goToForgotPin}
              className="text-accent-blue text-sm min-h-[44px]"
            >
              Forgot PIN?
            </button>
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
          onClick={() => (step === 'dodid' ? handleDodIdSubmit() : handlePinSubmit())}
          disabled={step === 'dodid' ? !cleanDodId || isLoading : !pin || isLoading}
        >
          {isLoading ? 'Loading...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
