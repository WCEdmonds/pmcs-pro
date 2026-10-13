import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { db } from '../utils/db';
import { getApiKey, setApiKey, clearApiKey, GEMINI_KEY } from '../utils/ai';
import { TOKEN_KEY, isNetworkError } from '../utils/api';
import { validateUic } from '../utils/uicLookup';
import { getSavedTheme, saveTheme } from '../utils/theme';
import { INSPECTION_TYPE_ORDER, INSPECTION_TYPE_LABELS, inspectionTypeLabel } from '../utils/inspectionTypes';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Toggle } from '../components/ui/Toggle';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { UicField } from '../components/ui/UicField';
import { ChangePinForm } from '../components/account/ChangePinForm';
import { EmailSettings } from '../components/account/EmailSettings';
import { APP_VERSION } from '../utils/version';
import { SyncBadge, SyncBanner } from '../components/sync/SyncStatus';
import { useUnsynced } from '../hooks/useSync';
import { ALL_RANKS } from '../data/ranks';
import type { InspectionType, User } from '../types';

const LOCAL_KEYS = [TOKEN_KEY, 'pmcs-api-token-issued', GEMINI_KEY, 'pmcs_active_session', 'pmcs_last_dodid'];

function ProfileForm({ user }: { user: User }) {
  const updateProfile = useUserStore((s) => s.updateProfile);
  const [rank, setRank] = useState(user.rank);
  const [firstName, setFirstName] = useState(user.firstName);
  const [mi, setMi] = useState(user.mi);
  const [lastName, setLastName] = useState(user.lastName);
  const [unit, setUnit] = useState(user.unit);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const uic = validateUic(unit);
  const dirty = rank !== user.rank || firstName !== user.firstName || mi !== user.mi || lastName !== user.lastName || uic.value !== user.unit;
  const valid = !!firstName.trim() && !!lastName.trim() && uic.valid;

  const handleSave = async () => {
    if (saving || !dirty || !valid) return;
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile({ rank, firstName, mi, lastName, unit: uic.value });
      setStatus({ kind: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setStatus({
        kind: 'error',
        text: isNetworkError(err)
          ? "Can't reach the server — profile not saved. Try again when online."
          : `Profile not saved: ${(err as Error).message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Select label="Rank" options={ALL_RANKS} value={rank} onChange={(e) => setRank(e.target.value)} />
      <div className="flex gap-3">
        <div className="flex-1">
          <Input label="First Name" id="settings-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        </div>
        <div className="w-16">
          <Input label="MI" id="settings-mi" value={mi} onChange={(e) => setMi(e.target.value.toUpperCase())} maxLength={1} />
        </div>
      </div>
      <Input label="Last Name" id="settings-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
      <UicField label="UIC" id="settings-uic" value={unit} onChange={setUnit} />
      {status && (
        <p className={`text-sm ${status.kind === 'ok' ? 'text-accent-green' : 'text-accent-red'}`} role="status">{status.text}</p>
      )}
      <Button onClick={handleSave} disabled={!dirty || !valid || saving}>
        {saving ? 'Saving…' : 'Save Profile'}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const focusEmail = (location.state as { focus?: string } | null)?.focus === 'email';
  const { user, updateUser, signOut } = useUserStore();
  const clearSession = useSessionStore((s) => s.clearSession);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStatus, setPinStatus] = useState('');
  const [showEverywhereModal, setShowEverywhereModal] = useState(false);
  const [everywhereBusy, setEverywhereBusy] = useState(false);
  const [everywhereError, setEverywhereError] = useState('');
  const [isDark, setIsDark] = useState(getSavedTheme() === 'dark');
  const [clearing, setClearing] = useState(false);

  const unsynced = useUnsynced(user?.dodId);
  const unsentCount = unsynced?.sessions.length ?? 0;
  const deviceUnsent = useLiveQuery(async () => {
    const states = await db.syncState.where('status').anyOf('pending', 'failed').primaryKeys();
    return states.length;
  }, []) ?? 0;
  const pendingResolutions = useLiveQuery(() => db.pendingFaultResolutions.count(), []) ?? 0;

  // "Add email" on the home-screen prompt lands here.
  useEffect(() => {
    if (focusEmail) document.getElementById('email-section')?.scrollIntoView?.({ block: 'start' });
  }, [focusEmail]);

  if (!user) return null;

  const handleThemeToggle = (dark: boolean) => {
    setIsDark(dark);
    saveTheme(dark ? 'dark' : 'light');
    updateUser({ theme: dark ? 'dark' : 'light' });
  };

  const handleSignOut = () => {
    setShowSignOutModal(false);
    clearSession();
    signOut();
    navigate('/login', { replace: true });
  };

  const handleSignOutEverywhere = async () => {
    if (everywhereBusy) return;
    setEverywhereBusy(true);
    setEverywhereError('');
    try {
      await useUserStore.getState().signOutEverywhere();
      clearSession();
      navigate('/login', { replace: true });
    } catch (err) {
      setEverywhereError(
        isNetworkError(err)
          ? "Can't reach the server. Connect to the internet and try again. You are still signed in."
          : `Could not sign out other devices: ${(err as Error).message}`,
      );
      setEverywhereBusy(false);
    }
  };

  const handleClearData = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      clearSession();
      await db.delete();
      await db.open();
    } catch (err) {
      console.error('Clearing data failed:', err);
    }
    for (const k of LOCAL_KEYS) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
    clearApiKey();
    signOut();
    window.location.replace('/login');
  };

  return (
    <div className="flex flex-col h-full px-4 pt-6 pb-4 overflow-y-auto">
      <h1 className="text-2xl font-bold font-display text-text-primary mb-6">Settings</h1>

      <div className="flex flex-col gap-6">
        <section aria-labelledby="sync-heading">
          <h2 id="sync-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">SYNC STATUS</h2>
          <SyncBanner />
          {unsentCount === 0 ? (
            <p className="text-sm text-accent-green" data-testid="all-synced">All your completed inspections are on the server.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Unsent inspections">
              {unsynced!.sessions.map((s) => (
                <li key={s.id} className="bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {s.bumperNumber} <span className="text-xs text-text-secondary font-normal">{s.date} · {inspectionTypeLabel(s.inspectionType)}</span>
                  </p>
                  <SyncBadge state={unsynced!.states.get(s.id)} />
                </li>
              ))}
            </ul>
          )}
          {deviceUnsent > unsentCount && (
            <p className="text-xs text-text-secondary mt-2">
              {deviceUnsent - unsentCount} unsent inspection{deviceUnsent - unsentCount === 1 ? '' : 's'} on this device belong to other soldiers. They will send when those soldiers sign in here.
            </p>
          )}
          {pendingResolutions > 0 && (
            <p className="text-xs text-text-secondary mt-2">{pendingResolutions} prior-fault update{pendingResolutions === 1 ? '' : 's'} waiting to send.</p>
          )}
        </section>

        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">PROFILE</h2>
          <ProfileForm key={`${user.dodId}-${user.unit}-${user.firstName}-${user.lastName}-${user.mi}-${user.rank}`} user={user} />
        </section>

        <section aria-labelledby="defaults-heading">
          <h2 id="defaults-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">DEFAULTS</h2>
          <SegmentedControl
            label="Default Inspection Type"
            options={INSPECTION_TYPE_ORDER}
            value={user.defaultInspectionType || 'BEFORE'}
            onChange={(v) => updateUser({ defaultInspectionType: v as InspectionType })}
            displayLabels={INSPECTION_TYPE_LABELS}
          />
        </section>

        <section aria-labelledby="ai-heading">
          <h2 id="ai-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">AI ASSISTANT</h2>
          <p className="text-xs text-text-secondary mb-2">Gemini API key for "Ask AI" on each PMCS step. Get one free at ai.google.dev.</p>
          <Input
            label="Gemini API Key"
            type="password"
            defaultValue={getApiKey() || ''}
            placeholder="AIza..."
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val) setApiKey(val);
              else clearApiKey();
            }}
          />
        </section>

        <section aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">TROUBLESHOOTING REVIEW</h2>
          <p className="text-xs text-text-secondary mb-2">Check the guided troubleshooting steps against the TM, flag wrong steps and record a verdict per tree. Works best on a computer.</p>
          <Button variant="secondary" fullWidth onClick={() => navigate('/review')}>Troubleshooting review</Button>
        </section>

        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">APPEARANCE</h2>
          <Toggle label="Dark Theme" checked={isDark} onChange={handleThemeToggle} />
        </section>

        <section id="email-section" aria-labelledby="email-heading">
          <h2 id="email-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">EMAIL (FOR PIN RESET)</h2>
          <EmailSettings />
        </section>

        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-xs font-semibold text-text-secondary font-display mb-3">ACCOUNT</h2>
          <p className="text-xs text-text-secondary mb-2">DOD ID: {user.dodId}</p>
          {pinStatus && <p className="text-sm text-accent-green mb-2" role="status">{pinStatus}</p>}
          <div className="flex flex-col gap-2">
            <Button variant="secondary" fullWidth onClick={() => { setPinStatus(''); setShowPinModal(true); }}>Change PIN</Button>
            <Button variant="secondary" fullWidth onClick={() => setShowSignOutModal(true)}>Sign Out</Button>
            <Button variant="secondary" fullWidth onClick={() => { setEverywhereError(''); setShowEverywhereModal(true); }}>
              Sign Out on All Devices
            </Button>
            <Button variant="danger" fullWidth onClick={() => setShowClearModal(true)}>Clear All Saved Data</Button>
          </div>
        </section>

        <p className="text-xs text-text-secondary text-center mt-4">PMCS Pro v{APP_VERSION}</p>
      </div>

      <Modal open={showSignOutModal} onClose={() => setShowSignOutModal(false)} title="Sign out?">
        {unsentCount > 0 ? (
          <p className="text-accent-amber text-sm mb-4" role="alert">
            {unsentCount === 1 ? '1 of your inspections has' : `${unsentCount} of your inspections have`} not been sent to the server yet. They stay on this phone and will send the next time you sign in here.
          </p>
        ) : (
          <p className="text-text-secondary text-sm mb-4">Your inspections stay on this device.</p>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowSignOutModal(false)}>Cancel</Button>
          <Button fullWidth onClick={handleSignOut}>Sign Out</Button>
        </div>
      </Modal>

      <Modal open={showPinModal} onClose={() => setShowPinModal(false)} title="Change PIN">
        <p className="text-text-secondary text-sm mb-3">Changing your PIN signs you out on every other device.</p>
        <ChangePinForm
          idPrefix="settings-pin"
          onDone={() => {
            setShowPinModal(false);
            setPinStatus('PIN changed. Other devices were signed out.');
          }}
        />
        <Button variant="ghost" fullWidth className="mt-2" onClick={() => setShowPinModal(false)}>Cancel</Button>
      </Modal>

      <Modal open={showEverywhereModal} onClose={() => !everywhereBusy && setShowEverywhereModal(false)} title="Sign out on all devices?">
        <p className="text-text-secondary text-sm mb-3">
          This signs you out on every phone and computer where you use PMCS Pro, <strong>including this phone</strong>. You'll need your PIN to sign in again.
        </p>
        {unsentCount > 0 ? (
          <p className="text-accent-amber text-sm mb-3" role="alert">
            {unsentCount === 1 ? '1 of your inspections has' : `${unsentCount} of your inspections have`} not been sent to the server yet. They stay on this phone and will send after you sign in again.
          </p>
        ) : (
          <p className="text-text-secondary text-sm mb-3">Your inspections stay on this device.</p>
        )}
        {everywhereError && <p className="text-accent-red text-sm mb-3" role="alert">{everywhereError}</p>}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowEverywhereModal(false)} disabled={everywhereBusy}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleSignOutEverywhere} disabled={everywhereBusy}>
            {everywhereBusy ? 'Signing out…' : 'Sign Out Everywhere'}
          </Button>
        </div>
      </Modal>

      <Modal open={showClearModal} onClose={() => setShowClearModal(false)} title="Clear All Data?">
        {deviceUnsent > 0 && (
          <p className="text-accent-red text-sm font-semibold mb-2" role="alert">
            Warning: {deviceUnsent} inspection{deviceUnsent === 1 ? ' has' : 's have'} NOT been sent to the server and will be lost forever.
          </p>
        )}
        <p className="text-text-secondary text-sm mb-4">
          This deletes every inspection, photo and profile on this device and signs you out. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowClearModal(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleClearData} disabled={clearing}>
            {clearing ? 'Deleting…' : 'Delete Everything'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
