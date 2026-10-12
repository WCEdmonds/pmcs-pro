import { useState, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { remoteSignUp } from '../utils/auth';
import { ApiError, isNetworkError } from '../utils/api';
import { saveUicMapping, validateUic, type UicLookup } from '../utils/uicLookup';
import { Button } from '../components/ui/Button';
import { UicUnitPrompt } from '../components/ui/UicUnitPrompt';
import { UicField } from '../components/ui/UicField';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ALL_RANKS } from '../data/ranks';
import { isLikelyEmail } from '../utils/email';

const PIN_RE = /^\d{6,12}$/;

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dodId = (location.state as { dodId?: string } | null)?.dodId || '';
  const setFromProfile = useUserStore((s) => s.setFromProfile);

  const [rank, setRank] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mi, setMi] = useState('');
  const [unit, setUnit] = useState('');
  const [uicLookup, setUicLookup] = useState<UicLookup | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUicPrompt, setShowUicPrompt] = useState(false);
  const busyRef = useRef(false);

  if (!/^\d{10}$/.test(dodId)) return <Navigate to="/login" replace />;

  const uic = validateUic(unit);
  const pinValid = PIN_RE.test(pin);
  const pinsMatch = pin === pinConfirm;
  const cleanEmail = email.trim();
  const emailValid = !cleanEmail || isLikelyEmail(cleanEmail);
  const isValid = !!rank && !!firstName.trim() && !!lastName.trim() && uic.valid && pinValid && pinsMatch && emailValid;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isValid || busyRef.current) return;
    busyRef.current = true;
    setIsLoading(true);
    setError('');
    setAlreadyRegistered(false);

    try {
      // 1. Create the account on the server. No server account → no local account.
      const profile = await remoteSignUp(dodId, pin, {
        rank,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        mi: mi.trim().toUpperCase(),
        unit: uic.value,
        ...(cleanEmail ? { email: cleanEmail } : {}),
      });
      await setFromProfile(profile);
      // 2. Now that we have a token, name a brand-new UIC.
      if (uicLookup?.status === 'new') {
        setShowUicPrompt(true);
        setIsLoading(false);
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyRegistered(true);
        setError('This DOD ID already has an account. Sign in with your PIN instead.');
      } else if (isNetworkError(err)) {
        setError("Can't reach the server. Your account was not created — check your connection and try again.");
      } else {
        setError(err instanceof Error && err.message ? `Account not created: ${err.message}` : 'Account not created. Try again.');
      }
      setIsLoading(false);
    } finally {
      busyRef.current = false;
    }
  };

  const finishUic = async (unitName?: string) => {
    setShowUicPrompt(false);
    if (unitName) await saveUicMapping(uic.value, unitName);
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col h-full px-4">
      <div className="pt-8 pb-4">
        <h1 className="text-2xl font-bold font-display text-text-primary">Set Up Profile</h1>
        <p className="mt-1 text-text-secondary text-sm">DOD ID: {dodId}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4">
        <Select
          label="Rank"
          options={ALL_RANKS}
          value={rank}
          onChange={(e) => setRank(e.target.value)}
          placeholder="Select rank"
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
            />
          </div>
          <div className="w-16">
            <Input
              label="MI"
              value={mi}
              onChange={(e) => setMi(e.target.value)}
              maxLength={1}
            />
          </div>
        </div>
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          autoComplete="family-name"
        />
        <UicField value={unit} onChange={setUnit} onLookup={setUicLookup} id="profile-uic" />
        <Input
          label="Choose a PIN (6-12 digits)"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
          inputMode="numeric"
          type="password"
          placeholder="6 to 12 digits"
          maxLength={12}
          autoComplete="new-password"
          error={pin && !pinValid ? 'PIN must be 6 to 12 digits' : undefined}
        />
        <Input
          label="Confirm PIN"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 12))}
          inputMode="numeric"
          type="password"
          placeholder="Re-enter PIN"
          maxLength={12}
          autoComplete="new-password"
          error={pinConfirm && !pinsMatch ? 'PINs do not match' : undefined}
        />
        <Input
          id="profile-email"
          label="Email (for PIN reset)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Optional"
          maxLength={254}
          aria-describedby="profile-email-hint"
          error={emailTouched && !emailValid ? 'Enter a valid email address' : undefined}
        />
        <p id="profile-email-hint" className="text-xs text-text-secondary -mt-2">
          Optional. A .mil or personal address both work. We'll email a code to confirm it, so you can reset a
          forgotten PIN yourself.
        </p>
        {error && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-accent-red">{error}</p>
            {alreadyRegistered && (
              <Button type="button" variant="secondary" onClick={() => navigate('/login', { replace: true })}>Go to sign in</Button>
            )}
          </div>
        )}
      </form>

      <div className="pb-[calc(16px+env(safe-area-inset-bottom))] flex flex-col gap-2">
        <Button size="lg" fullWidth onClick={() => handleSubmit()} disabled={!isValid || isLoading}>
          {isLoading ? 'Creating Account...' : 'Save & Continue'}
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/login', { replace: true })}>
          Back
        </Button>
      </div>

      <UicUnitPrompt
        uic={uic.value}
        open={showUicPrompt}
        onSave={(name) => finishUic(name)}
        onCancel={() => finishUic()}
      />
    </div>
  );
}
