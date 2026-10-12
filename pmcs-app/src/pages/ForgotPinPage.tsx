import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { confirmPinReset, requestPinReset } from '../utils/api';
import { CODE_RE, CODE_SENT_NOTICE, codeDigits, emailErrorMessage, needsNewCode } from '../utils/email';
import { validateNewPin } from '../utils/pin';
import { useUserStore } from '../stores/userStore';
import { useOnline } from '../hooks/useOnline';
import { NewPinFields } from '../components/account/NewPinFields';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

/**
 * "Forgot PIN?" from the login screen: (1) DOD ID → the server emails a code to the
 * account's confirmed email; (2) code + new PIN → signed in, like a normal login.
 * Needs the internet; nothing on the phone is touched.
 */
export default function ForgotPinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnline();
  const [dodId, setDodId] = useState(() => {
    const given = (location.state as { dodId?: string } | null)?.dodId ?? '';
    return given.replace(/\D/g, '').slice(0, 10);
  });
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; next?: string; confirm?: string }>({});
  const [error, setError] = useState('');
  const [offerNewCode, setOfferNewCode] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendCode = (again = false) => run(async () => {
    if (dodId.length !== 10) {
      setError('DOD ID must be 10 digits.');
      return;
    }
    setError('');
    setOfferNewCode(false);
    try {
      await requestPinReset(dodId);
      setCode('');
      setFieldErrors({});
      setResent(again);
      setStep('confirm');
    } catch (err) {
      setError(emailErrorMessage(err, 'Code not sent. Try again.'));
    }
  });

  const handleRequest = (e?: React.FormEvent) => {
    e?.preventDefault();
    void sendCode();
  };

  const handleConfirm = (e?: React.FormEvent) => {
    e?.preventDefault();
    const errors: typeof fieldErrors = { ...validateNewPin(next, confirm) };
    if (!CODE_RE.test(code)) errors.code = 'Enter the 6-digit code from the email.';
    setFieldErrors(errors);
    setError('');
    setOfferNewCode(false);
    if (errors.code || errors.next || errors.confirm) return;
    void run(async () => {
      try {
        const profile = await confirmPinReset(dodId, code, next);
        await useUserStore.getState().setFromProfile(profile);
        navigate('/', { replace: true });
      } catch (err) {
        setError(emailErrorMessage(err, 'PIN not reset. Try again.'));
        setOfferNewCode(needsNewCode(err));
      }
    });
  };

  return (
    <main className="flex flex-col h-full px-4 overflow-y-auto" aria-labelledby="forgot-pin-heading">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-center max-w-sm">
          <h1 id="forgot-pin-heading" className="text-3xl font-bold font-display text-text-primary tracking-tight">
            Reset your PIN
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            {step === 'request'
              ? "We'll email a 6-digit code to the confirmed email on your account."
              : 'Enter the code from the email and choose a new PIN.'}
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          {!online && (
            <p className="flex items-start gap-2 text-sm text-accent-amber" role="status" data-testid="forgot-pin-offline">
              <WifiOff size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              You're offline. Connect to the internet to reset your PIN.
            </p>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest} noValidate className="flex flex-col gap-3" aria-busy={busy}>
              <Input
                id="forgot-dodid"
                label="DOD ID Number"
                value={dodId}
                onChange={(e) => setDodId(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter your 10-digit DOD ID"
                autoFocus={!dodId}
                autoComplete="off"
              />
              {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
              <Button type="submit" fullWidth disabled={busy || !online || !dodId}>
                {busy ? 'Sending…' : 'Email Me a Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} noValidate className="flex flex-col gap-3" aria-busy={busy}>
              <p
                className="text-sm text-text-primary bg-accent-blue/10 border border-accent-blue/30 rounded-[var(--radius-md)] p-3"
                role="status"
                data-testid="reset-code-sent"
              >
                {resent && 'New code requested. '}{CODE_SENT_NOTICE}
              </p>
              <p className="text-xs text-text-secondary">DOD ID: {dodId}</p>
              <Input
                id="forgot-code"
                label="6-digit code"
                value={code}
                onChange={(e) => setCode(codeDigits(e.target.value))}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus
                error={fieldErrors.code}
                aria-invalid={!!fieldErrors.code}
              />
              <NewPinFields
                idPrefix="forgot-pin"
                next={next}
                confirm={confirm}
                onNextChange={setNext}
                onConfirmChange={setConfirm}
                errors={fieldErrors}
              />
              {error && (
                <div role="alert" className="flex flex-col gap-2">
                  <p className="text-sm text-accent-red">{error}</p>
                  {offerNewCode && (
                    <Button type="button" variant="secondary" onClick={() => sendCode(true)} disabled={busy || !online}>
                      Send a new code
                    </Button>
                  )}
                </div>
              )}
              <Button type="submit" fullWidth disabled={busy || !online || !code || !next || !confirm}>
                {busy ? 'Saving…' : 'Reset PIN & Sign In'}
              </Button>
              {!offerNewCode && (
                <button
                  type="button"
                  onClick={() => sendCode(true)}
                  disabled={busy || !online}
                  className="text-accent-blue text-sm min-h-[44px] disabled:opacity-50"
                >
                  Didn't get it? Send a new code
                </button>
              )}
              <button
                type="button"
                onClick={() => { setStep('request'); setError(''); setOfferNewCode(false); }}
                className="text-accent-blue text-sm min-h-[44px]"
              >
                ← Different DOD ID
              </button>
            </form>
          )}

          <Button variant="ghost" fullWidth onClick={() => navigate('/login', { replace: true })}>
            Back to sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
