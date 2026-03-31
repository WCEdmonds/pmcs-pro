import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { supabaseSignUp } from '../utils/auth';
import { getUnitName, saveUicMapping } from '../utils/uicLookup';
import { Button } from '../components/ui/Button';
import { UicUnitPrompt } from '../components/ui/UicUnitPrompt';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { ALL_RANKS } from '../data/ranks';

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dodId = (location.state as { dodId?: string })?.dodId || '';
  const createUser = useUserStore((s) => s.createUser);

  const [rank, setRank] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mi, setMi] = useState('');
  const [unit, setUnit] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUicPrompt, setShowUicPrompt] = useState(false);

  const isValid = rank && firstName.trim() && lastName.trim() && unit.trim() && pin.length >= 4;
  const pinsMatch = pin === pinConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    if (!pinsMatch) {
      setError('PINs do not match');
      return;
    }

    // Check if UIC is known — if not, prompt for unit name
    const existingName = await getUnitName(unit.trim());
    if (!existingName) {
      setShowUicPrompt(true);
      return;
    }

    await doSubmit();
  };

  const handleUicSave = async (unitName: string) => {
    await saveUicMapping(unit.trim(), unitName);
    setShowUicPrompt(false);
    await doSubmit();
  };

  const doSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Register with Supabase
      await supabaseSignUp(dodId, pin, {
        rank,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        mi: mi.trim(),
        unit: unit.trim(),
      });
    } catch (err: any) {
      console.warn('Supabase signup failed, continuing with local only:', err);
      // Don't block — local auth still works
    }

    // Also save locally in Dexie
    await createUser({
      dodId,
      rank,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mi: mi.trim(),
      unit: unit.trim(),
    });

    setIsLoading(false);
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full px-4">
      <div className="pt-8 pb-4">
        <h1 className="text-2xl font-bold font-display text-text-primary">Set Up Profile</h1>
        <p className="mt-1 text-text-secondary text-sm">
          {dodId ? `DOD ID: ${dodId}` : 'Create your profile'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4">
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
        <Input
          label="UIC (Unit Identification Code)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g., WABC12"
          autoComplete="organization"
        />
        <Input
          label="Choose a PIN (4-6 digits)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          type="password"
          placeholder="e.g., 1234"
          maxLength={6}
        />
        <Input
          label="Confirm PIN"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          type="password"
          placeholder="Re-enter PIN"
          maxLength={6}
          error={pinConfirm && !pinsMatch ? 'PINs do not match' : undefined}
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </form>

      <div className="pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button size="lg" fullWidth onClick={handleSubmit} disabled={!isValid || !pinsMatch || isLoading}>
          {isLoading ? 'Creating Account...' : 'Save & Continue'}
        </Button>
      </div>

      <UicUnitPrompt
        uic={unit.trim().toUpperCase()}
        open={showUicPrompt}
        onSave={handleUicSave}
        onCancel={() => { setShowUicPrompt(false); doSubmit(); }}
      />
    </div>
  );
}
