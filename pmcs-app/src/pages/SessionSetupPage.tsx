import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { loadPmcsData } from '../utils/loadPmcsData';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import type { RosterVehicle } from '../data/vehicleRoster';
import { ALL_RANKS } from '../data/ranks';
import { getUnitName, saveUicMapping } from '../utils/uicLookup';
import { supabase } from '../utils/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { UicUnitPrompt } from '../components/ui/UicUnitPrompt';
import type { InspectionType, VehicleType } from '../types';

// Map Supabase vehicle_type strings to app VehicleType
function toVehicleType(model: string | null): VehicleType | null {
  if (!model) return null;
  if (['M1101', 'M1102'].some(m => model.includes(m))) return 'M1101_TRAILER';
  if (['MEP803', 'MEP813', 'MEP-803', 'MEP-813', 'MEP802', 'MEP-802'].some(m => model.includes(m))) return 'MEP803A';
  if (['M1151', 'M1151A1', 'M1113', 'M1097', 'M1165A1'].some(m => model.includes(m))) return 'M1151';
  if (['M1152', 'M1152A1'].some(m => model.includes(m))) return 'M1152';
  if (['M1078', 'M1083', 'M1085'].some(m => model.includes(m))) return 'LMTV_M1078';
  return null;
}


export default function SessionSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialVehicleType = (searchParams.get('vehicle') || 'M1151') as VehicleType;
  const user = useUserStore((s) => s.user);
  const startSession = useSessionStore((s) => s.startSession);

  // Vehicle picker state
  const [selectedRosterVehicle, setSelectedRosterVehicle] = useState<RosterVehicle & { vehicleType: VehicleType } | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [pmcsVehicles, setPmcsVehicles] = useState<(RosterVehicle & { vehicleType: VehicleType })[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  // Load vehicles from Supabase for the soldier's unit. If empty, soldier uses manual entry.
  useEffect(() => {
    async function loadFromSupabase() {
      if (!user?.unit) { setRosterLoaded(true); return; }
      try {
        const { data } = await supabase
          .from('vehicles')
          .select('bumper_number, vehicle_type, serial_number, unit, section, description, current_odometer')
          .eq('unit', user.unit)
          .order('bumper_number');
        if (data && data.length > 0) {
          const mapped = data
            .map((v): (RosterVehicle & { vehicleType: VehicleType }) | null => {
              const vt = toVehicleType(v.vehicle_type);
              if (!vt) return null;
              return {
                bumperNumber: v.bumper_number || '',
                model: v.vehicle_type || '',
                description: v.description || v.vehicle_type || '',
                serialNumber: v.serial_number || '',
                nsn: '',
                lin: '',
                section: v.section || '',
                vehicleType: vt,
              };
            })
            .filter((v): v is RosterVehicle & { vehicleType: VehicleType } => v !== null);
          setPmcsVehicles(mapped);
        }
      } catch {
        // Offline — no roster, soldier uses manual entry
      }
      setRosterLoaded(true);
    }
    loadFromSupabase();
  }, [user?.unit]);

  // Derived vehicle type: from roster selection, or from URL param for manual entry
  const vehicleType = selectedRosterVehicle?.vehicleType ?? initialVehicleType;
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === vehicleType);

  const [bumperNumber, setBumperNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [odometer, setOdometer] = useState('');
  const [error, setError] = useState('');
  const [rank, setRank] = useState(user?.rank || '');
  const [inspectorName, setInspectorName] = useState(
    user ? `${user.firstName} ${user.lastName}` : ''
  );
  const [unit, setUnit] = useState(user?.unit || '');
  const [inspectionType, setInspectionType] = useState<InspectionType>(
    user?.defaultInspectionType || '30_DAY'
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUicPrompt, setShowUicPrompt] = useState(false);

  // Filter roster by the vehicle type selected on the home page, then by search text
  const filteredRosterVehicles = useMemo(() => {
    const typeFiltered = pmcsVehicles.filter((v) => v.vehicleType === initialVehicleType);
    if (!vehicleSearch.trim()) return typeFiltered;
    const q = vehicleSearch.toUpperCase();
    return typeFiltered.filter(
      (v) =>
        v.bumperNumber.toUpperCase().includes(q) ||
        v.model.toUpperCase().includes(q) ||
        v.description.toUpperCase().includes(q) ||
        v.section.toUpperCase().includes(q)
    );
  }, [pmcsVehicles, vehicleSearch, initialVehicleType]);

  const handleSelectRosterVehicle = (rv: RosterVehicle & { vehicleType: VehicleType }) => {
    setSelectedRosterVehicle(rv);
    setBumperNumber(rv.bumperNumber);
    setSerialNumber(rv.serialNumber);
    setIsManualEntry(false);
    setVehicleSearch('');
  };

  const handleSwitchToManual = () => {
    setSelectedRosterVehicle(null);
    setIsManualEntry(true);
    setBumperNumber('');
    setSerialNumber('');
    setVehicleSearch('');
  };

  const handleSwitchToRoster = () => {
    setSelectedRosterVehicle(null);
    setIsManualEntry(false);
    setBumperNumber('');
    setSerialNumber('');
  };

  const isValid = bumperNumber.trim() && odometer.trim();

  const handleStart = async () => {
    if (!isValid) return;

    // Check if UIC is known
    if (unit.trim()) {
      const existingName = await getUnitName(unit.trim());
      if (!existingName) {
        setShowUicPrompt(true);
        return;
      }
    }

    await doStart();
  };

  const handleUicSave = async (unitName: string) => {
    await saveUicMapping(unit.trim(), unitName);
    setShowUicPrompt(false);
    await doStart();
  };

  const doStart = async () => {
    setIsLoading(true);

    try {
      const sessionId = crypto.randomUUID();
      const vehicleData = await loadPmcsData(vehicleType);

      const session = {
        id: sessionId,
        date,
        vehicleId: `${vehicleType}-${bumperNumber.trim()}`,
        vehicleType,
        bumperNumber: bumperNumber.trim(),
        serialNumber: serialNumber.trim() || undefined,
        odometer: parseInt(odometer, 10),
        inspectorDodId: user?.dodId || 'anonymous',
        inspectorRank: rank,
        inspectorName: inspectorName.trim(),
        unit: unit.trim(),
        inspectionType,
        status: 'IN_PROGRESS' as const,
        createdAt: new Date().toISOString(),
      };

      startSession(session, vehicleData);
      navigate(`/session/${sessionId}/prior-faults`);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-4">
      <div className="pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="text-accent-blue text-sm mb-2 min-h-[44px] flex items-center"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold font-display text-text-primary">
          New Inspection
        </h1>
        {vehicle && (
          <p className="mt-1 text-text-secondary text-sm">{vehicle.name}</p>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4">
        {/* ── Vehicle Picker (only shown when roster has vehicles) ── */}
        {!isManualEntry && !selectedRosterVehicle && rosterLoaded && pmcsVehicles.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-text-secondary">
              Select Vehicle
            </label>
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search bumper #, model, or section..."
              autoFocus
              className="min-h-[48px] px-3 text-base bg-bg-tertiary text-text-primary border border-border rounded-[var(--radius-md)] placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
            />
            <div className="max-h-52 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
              {filteredRosterVehicles.map((rv) => (
                <button
                  key={rv.bumperNumber}
                  type="button"
                  onClick={() => handleSelectRosterVehicle(rv)}
                  className="w-full text-left px-3 py-3 min-h-[48px] border-b border-border last:border-b-0 active:bg-bg-tertiary"
                >
                  <span className="font-display font-bold text-text-primary">
                    {rv.bumperNumber}
                  </span>
                  <span className="text-text-secondary text-sm ml-2">
                    {rv.model} &middot; {rv.section}
                  </span>
                </button>
              ))}
              {filteredRosterVehicles.length === 0 && (
                <p className="px-3 py-3 text-sm text-text-secondary">
                  No matching vehicles
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSwitchToManual}
              className="text-accent-blue text-sm min-h-[44px] text-left"
            >
              Not in list — enter manually
            </button>
          </div>
        )}

        {/* ── Selected Roster Vehicle ── */}
        {selectedRosterVehicle && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">
                Vehicle
              </label>
              <button
                type="button"
                onClick={handleSwitchToRoster}
                className="text-accent-blue text-sm min-h-[44px] flex items-center"
              >
                Change
              </button>
            </div>
            <div className="px-3 py-3 bg-bg-tertiary rounded-[var(--radius-md)] border border-border">
              <p className="font-display font-bold text-text-primary">
                {selectedRosterVehicle.bumperNumber}
              </p>
              <p className="text-sm text-text-secondary">
                {selectedRosterVehicle.model} &middot; {selectedRosterVehicle.section} &middot; SN {selectedRosterVehicle.serialNumber}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                PMCS type: {vehicle?.name}
              </p>
            </div>
          </div>
        )}

        {/* ── Manual entry fields (shown when "Not in list", no roster, or roster empty) ── */}
        {(isManualEntry || (rosterLoaded && pmcsVehicles.length === 0 && !selectedRosterVehicle)) && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">
                {pmcsVehicles.length > 0 ? 'Manual Entry' : 'Select Vehicle'}
              </label>
              {pmcsVehicles.length > 0 && (
                <button
                  type="button"
                  onClick={handleSwitchToRoster}
                  className="text-accent-blue text-sm min-h-[44px] flex items-center"
                >
                  Back to roster
                </button>
              )}
            </div>
            <Input
              label="Bumper Number"
              value={bumperNumber}
              onChange={(e) => setBumperNumber(e.target.value.toUpperCase())}
              placeholder="e.g., HQ-31"
            />
            <Input
              label="Serial / Registration Number (optional)"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="If known"
            />
          </>
        )}

        <Input
          label="Odometer (miles)"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g., 34218"
        />

        <div className="flex gap-3">
          <div className="w-28">
            <Select
              label="Rank"
              options={ALL_RANKS}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="Rank"
            />
          </div>
          <div className="flex-1">
            <Input
              label="Inspector Name"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
            />
          </div>
        </div>

        <Input
          label="UIC"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g., WABC12"
        />

        <SegmentedControl
          label="Inspection Type"
          options={['30_DAY', 'BEFORE', 'DURING', 'AFTER'] as const}
          value={inspectionType}
          onChange={setInspectionType}
          displayLabels={{ '30_DAY': '30-Day', BEFORE: 'Before', DURING: 'During', AFTER: 'After' }}
        />

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="pb-[calc(16px+env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          fullWidth
          onClick={handleStart}
          disabled={!isValid || isLoading}
        >
          {isLoading ? 'Loading...' : 'Start Inspection'}
        </Button>
        {error && <p className="text-accent-red text-sm mt-2 text-center">{error}</p>}
      </div>

      <UicUnitPrompt
        uic={unit.trim().toUpperCase()}
        open={showUicPrompt}
        onSave={handleUicSave}
        onCancel={() => { setShowUicPrompt(false); doStart(); }}
      />
    </div>
  );
}
