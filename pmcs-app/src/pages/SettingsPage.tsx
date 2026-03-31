import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { db } from '../utils/db';
import { getApiKey, setApiKey, clearApiKey } from '../utils/ai';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Toggle } from '../components/ui/Toggle';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ALL_RANKS } from '../data/ranks';
import type { InspectionType } from '../types';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useUserStore();
  const [showClearModal, setShowClearModal] = useState(false);

  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  if (!user) return null;

  const handleThemeToggle = (dark: boolean) => {
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateUser({ theme: dark ? 'dark' : 'light' });
  };

  const handleClearData = async () => {
    await db.delete();
    logout();
    localStorage.removeItem('pmcs_last_dodid');
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full px-4 pt-6 pb-4 overflow-y-auto">
      <h1 className="text-2xl font-bold font-display text-text-primary mb-6">Settings</h1>

      <div className="flex flex-col gap-5">
        <section>
          <h2 className="text-xs font-semibold text-text-secondary font-display mb-3">PROFILE</h2>
          <div className="flex flex-col gap-3">
            <Select
              label="Rank"
              options={ALL_RANKS}
              value={user.rank}
              onChange={(e) => updateUser({ rank: e.target.value })}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label="First Name"
                  value={user.firstName}
                  onBlur={(e) => updateUser({ firstName: e.target.value })}
                  onChange={() => {}}
                  defaultValue={user.firstName}
                />
              </div>
              <div className="w-16">
                <Input
                  label="MI"
                  value={user.mi}
                  onBlur={(e) => updateUser({ mi: e.target.value })}
                  onChange={() => {}}
                  defaultValue={user.mi}
                  maxLength={1}
                />
              </div>
            </div>
            <Input
              label="Last Name"
              defaultValue={user.lastName}
              onBlur={(e) => updateUser({ lastName: e.target.value })}
            />
            <Input
              label="UIC"
              defaultValue={user.unit}
              onBlur={(e) => updateUser({ unit: e.target.value })}
              placeholder="e.g., WABC12"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-secondary font-display mb-3">DEFAULTS</h2>
          <SegmentedControl
            label="Default Inspection Type"
            options={['30_DAY', 'BEFORE', 'DURING', 'AFTER'] as const}
            value={user.defaultInspectionType || '30_DAY'}
            onChange={(v) => updateUser({ defaultInspectionType: v as InspectionType })}
            displayLabels={{ '30_DAY': '30-Day', BEFORE: 'Before', DURING: 'During', AFTER: 'After' }}
          />
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-secondary font-display mb-3">AI ASSISTANT</h2>
          <p className="text-xs text-text-secondary mb-2">Gemini API key for "Ask AI" on each PMCS step. Get one free at ai.google.dev.</p>
          <div className="flex gap-2">
            <div className="flex-1">
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
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-secondary font-display mb-3">APPEARANCE</h2>
          <Toggle label="Dark Theme" checked={isDark} onChange={handleThemeToggle} />
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-secondary font-display mb-3">DATA</h2>
          <p className="text-xs text-text-secondary mb-2">DOD ID: {user.dodId}</p>
          <Button variant="danger" fullWidth onClick={() => setShowClearModal(true)}>
            Clear All Saved Data
          </Button>
        </section>

        <p className="text-xs text-text-secondary/50 text-center mt-4">PMCS Pro v0.1.0</p>
      </div>

      <Modal open={showClearModal} onClose={() => setShowClearModal(false)} title="Clear All Data?">
        <p className="text-text-secondary text-sm mb-4">
          This will delete all inspections, vehicles, and your profile. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowClearModal(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={handleClearData}>Delete Everything</Button>
        </div>
      </Modal>
    </div>
  );
}
