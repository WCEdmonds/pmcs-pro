import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { loadPmcsData } from '../utils/loadPmcsData';
import { VEHICLE_REGISTRY } from '../data/vehicles';
import type { RosterVehicle } from '../data/vehicleRoster';
import { ALL_RANKS } from '../data/ranks';
import { saveUicMapping, validateUic, normalizeUic, type UicLookup } from '../utils/uicLookup';
import { api } from '../utils/api';
import { db } from '../utils/db';
import { localDateString, parseOdometer } from '../utils/format';
import { availableInspectionTypes, stepsForInspection, INSPECTION_TYPE_LABELS } from '../utils/inspectionTypes';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { UicField } from '../components/ui/UicField';
import { UicUnitPrompt } from '../components/ui/UicUnitPrompt';
import type { InspectionSession, InspectionType, PmcsVehicleData, VehicleType } from '../types';

// Map server vehicle_type strings to app VehicleType
function toVehicleType(model: string | null): VehicleType | null {
  if (!model) return null;
  const m = model.toUpperCase().replace(/[\s-]/g, '');
  if (/^M110[12]/.test(m)) return 'M1101_TRAILER';
  if (/^MEP(803|813)/.test(m)) return 'MEP803A';          // TM 9-6115-642-10
  if (/^MEP(802|812)/.test(m)) return 'MEP802A';          // TM 9-6115-641-10
  if (/^MEP103[01]/.test(m)) return 'MEP1030';            // TM 9-6115-749-10 (AMMPS 5 kW)
  if (/^MEP83[12]/.test(m)) return 'MEP831A';             // MEP831, MEP831A, MEP832A (TM 9-6115-639-13&P)
  if (/^M1151/.test(m)) return 'M1151';
  if (/^(M1152|M1113|M1165)/.test(m)) return 'M1152';      // no weapon station
  if (/^M1097/.test(m)) return 'M1097';                    // M1097, M1097A1, M1097A2 (TM 9-2320-280-10)
  if (/^M1078(?!A)/.test(m)) return 'LMTV_M1078';          // M1078A1/A1P2, M1083, M1085 → null
  return null;                                              // unknown models → null
}

type PickerVehicle = RosterVehicle & { vehicleType: VehicleType };

/** "M1083A1 · IEW · SN 12345" — skips empty parts and app-internal type ids. */
function rosterLabel(rv: PickerVehicle): string {
  const registry = VEHICLE_REGISTRY.find((v) => v.type === rv.model);
  const model = registry ? registry.name : rv.model;
  const parts = [model || rv.description, rv.section, rv.serialNumber ? `SN ${rv.serialNumber}` : ''];
  return parts.map((p) => (p || '').trim()).filter(Boolean).join(' · ');
}

export default function SessionSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialVehicleType = (searchParams.get('vehicle') || 'M1151') as VehicleType;
  const user = useUserStore((s) => s.user);
  const startSession = useSessionStore((s) => s.startSession);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const discardSession = useSessionStore((s) => s.discardSession);

  // Vehicle picker state
  const [selectedRosterVehicle, setSelectedRosterVehicle] = useState<PickerVehicle | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [pmcsVehicles, setPmcsVehicles] = useState<PickerVehicle[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  // Vehicles for the soldier's unit (server scopes to the user's unit). If empty, manual entry.
  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      try {
        const data = await api<Array<{
          bumper_number: string | null;
          vehicle_type: string | null;
          serial_number: string | null;
          section: string | null;
          description: string | null;
          nomenclature?: string | null;
        }>>('GET', '/vehicles');
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const mapped = data
            .map((v): PickerVehicle | null => {
              // Vehicles first created by this app's sync carry the app's own type id (e.g. LMTV_M1078).
              const vt = VEHICLE_REGISTRY.some((r) => r.type === v.vehicle_type)
                ? (v.vehicle_type as VehicleType)
                : toVehicleType(v.vehicle_type);
              if (!vt || !v.bumper_number) return null;
              return {
                bumperNumber: v.bumper_number,
                model: v.vehicle_type || '',
                description: v.description || v.nomenclature || '',
                serialNumber: v.serial_number || '',
                nsn: '',
                lin: '',
                section: v.section || '',
                vehicleType: vt,
              };
            })
            .filter((v): v is PickerVehicle => v !== null);
          setPmcsVehicles(mapped);
        }
      } catch {
        // Offline — no roster, soldier uses manual entry
      }
      if (!cancelled) setRosterLoaded(true);
    }
    loadRoster();
    return () => { cancelled = true; };
  }, [user?.unit]);

  const vehicleType = selectedRosterVehicle?.vehicleType ?? initialVehicleType;
  const vehicle = VEHICLE_REGISTRY.find((v) => v.type === vehicleType);

  // PMCS data for this vehicle → which inspection types actually have items
  const [vehicleData, setVehicleData] = useState<{ type: VehicleType; data: PmcsVehicleData } | null>(null);
  const [dataError, setDataError] = useState('');
  useEffect(() => {
    let cancelled = false;
    loadPmcsData(vehicleType)
      .then((data) => { if (!cancelled) { setVehicleData({ type: vehicleType, data }); setDataError(''); } })
      .catch(() => { if (!cancelled) setDataError('Could not load the PMCS checklist for this vehicle.'); });
    return () => { cancelled = true; };
  }, [vehicleType]);
  const currentData = vehicleData?.type === vehicleType ? vehicleData.data : null;
  const typeOptions = useMemo(() => (currentData ? availableInspectionTypes(currentData) : []), [currentData]);

  const [bumperNumber, setBumperNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [odometer, setOdometer] = useState('');
  const [odometerTouched, setOdometerTouched] = useState(false);
  const [error, setError] = useState('');
  const [rank, setRank] = useState(user?.rank || '');
  const [inspectorName, setInspectorName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : ''
  );
  const [unit, setUnit] = useState(normalizeUic(user?.unit));
  const [uicLookup, setUicLookup] = useState<UicLookup | null>(null);
  const [chosenType, setChosenType] = useState<InspectionType | null>(null);
  const [date, setDate] = useState(() => localDateString());
  const [isLoading, setIsLoading] = useState(false);
  const [showUicPrompt, setShowUicPrompt] = useState(false);
  const [inProgress, setInProgress] = useState<InspectionSession | null>(null);
  const startingRef = useRef(false);

  // Selected type must be one this vehicle has; otherwise fall back to the default/first.
  const inspectionType: InspectionType | null = useMemo(() => {
    if (chosenType && typeOptions.includes(chosenType)) return chosenType;
    if (user?.defaultInspectionType && typeOptions.includes(user.defaultInspectionType)) return user.defaultInspectionType;
    return typeOptions[0] ?? null;
  }, [chosenType, typeOptions, user?.defaultInspectionType]);

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
  const rosterForType = pmcsVehicles.filter((v) => v.vehicleType === initialVehicleType);

  const handleSelectRosterVehicle = (rv: PickerVehicle) => {
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

  const odo = parseOdometer(odometer);
  const odometerError = odometerTouched && 'error' in odo ? odo.error : undefined;
  const uicCheck = validateUic(unit);
  const isValid = !!bumperNumber.trim() && 'value' in odo && uicCheck.valid && !!inspectionType && !!date;

  const doStart = useCallback(async () => {
    if (!inspectionType || !('value' in odo)) return;
    setIsLoading(true);
    setError('');
    try {
      const data = currentData ?? await loadPmcsData(vehicleType);
      if (stepsForInspection(data, inspectionType).length === 0) {
        throw new Error(`This vehicle has no ${INSPECTION_TYPE_LABELS[inspectionType]} PMCS items. Pick another inspection type.`);
      }
      const sessionId = crypto.randomUUID();
      const bumper = bumperNumber.trim().toUpperCase();
      const session: InspectionSession = {
        id: sessionId,
        date,
        vehicleId: `${vehicleType}-${bumper}`,
        vehicleType,
        bumperNumber: bumper,
        serialNumber: serialNumber.trim() || undefined,
        odometer: odo.value,
        inspectorDodId: user!.dodId,
        inspectorRank: rank,
        inspectorName: inspectorName.trim(),
        unit: uicCheck.value,
        inspectionType,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
      };
      await startSession(session, data);
      navigate(`/session/${sessionId}/prior-faults`);
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
      startingRef.current = false;
    }
  }, [inspectionType, odo, currentData, vehicleType, bumperNumber, date, serialNumber, user, rank, inspectorName, uicCheck.value, startSession, navigate]);

  const proceed = useCallback(async () => {
    if (uicLookup?.status === 'new') {
      setShowUicPrompt(true);
      return;
    }
    await doStart();
  }, [uicLookup, doStart]);

  const handleStart = async () => {
    setOdometerTouched(true);
    if (!isValid || startingRef.current || !user) return;
    startingRef.current = true;
    // One in-progress inspection at a time per soldier: resume or discard it first.
    const existing = (await db.sessions.where('inspectorDodId').equals(user.dodId).toArray())
      .find((s) => s.status === 'IN_PROGRESS');
    if (existing) {
      setInProgress(existing);
      startingRef.current = false;
      return;
    }
    await proceed();
  };

  const handleResumeExisting = async () => {
    if (!inProgress) return;
    const ok = await restoreSession(inProgress.id);
    setInProgress(null);
    if (ok) navigate(`/session/${inProgress.id}/pmcs`);
  };

  const handleDiscardExisting = async () => {
    if (!inProgress || startingRef.current) return;
    startingRef.current = true;
    await discardSession(inProgress.id);
    setInProgress(null);
    await proceed();
  };

  const handleUicSave = async (unitName: string) => {
    setShowUicPrompt(false);
    await saveUicMapping(uicCheck.value, unitName);
    await doStart();
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
        {!isManualEntry && !selectedRosterVehicle && rosterLoaded && rosterForType.length > 0 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="vehicle-search" className="text-sm font-medium text-text-secondary">
              Select Vehicle
            </label>
            <input
              id="vehicle-search"
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search bumper #, model, or section..."
              className="min-h-[48px] px-3 text-base bg-bg-tertiary text-text-primary border border-border rounded-[var(--radius-md)] placeholder:text-text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
            />
            <div className="max-h-52 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-bg-secondary">
              {filteredRosterVehicles.map((rv, i) => (
                <button
                  key={`${rv.bumperNumber}-${i}`}
                  type="button"
                  onClick={() => handleSelectRosterVehicle(rv)}
                  className="w-full text-left px-3 py-3 min-h-[48px] border-b border-border last:border-b-0 active:bg-bg-tertiary"
                >
                  <span className="font-display font-bold text-text-primary">
                    {rv.bumperNumber}
                  </span>
                  {rosterLabel(rv) && (
                    <span className="text-text-secondary text-sm ml-2">{rosterLabel(rv)}</span>
                  )}
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

        {selectedRosterVehicle && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                Vehicle
              </span>
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
              {rosterLabel(selectedRosterVehicle) && (
                <p className="text-sm text-text-secondary">{rosterLabel(selectedRosterVehicle)}</p>
              )}
              <p className="text-xs text-text-secondary mt-1">
                PMCS type: {vehicle?.name}
              </p>
            </div>
          </div>
        )}

        {(isManualEntry || (rosterLoaded && rosterForType.length === 0 && !selectedRosterVehicle)) && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                {rosterForType.length > 0 ? 'Manual Entry' : 'Vehicle'}
              </span>
              {rosterForType.length > 0 && (
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
          onBlur={() => setOdometerTouched(true)}
          inputMode="numeric"
          placeholder="e.g., 34218"
          maxLength={12}
          error={odometerError}
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

        <UicField label="UIC" id="session-uic" value={unit} onChange={setUnit} onLookup={setUicLookup} />

        {typeOptions.length > 0 && inspectionType ? (
          <SegmentedControl
            label="Inspection Type"
            options={typeOptions}
            value={inspectionType}
            onChange={setChosenType}
            displayLabels={INSPECTION_TYPE_LABELS}
          />
        ) : currentData ? (
          <p className="text-sm text-accent-red">This vehicle has no PMCS items yet.</p>
        ) : (
          <p className="text-sm text-text-secondary">{dataError || 'Loading checklist…'}</p>
        )}

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
        {error && <p className="text-accent-red text-sm mt-2 text-center" role="alert">{error}</p>}
      </div>

      <UicUnitPrompt
        uic={uicCheck.value}
        open={showUicPrompt}
        onSave={handleUicSave}
        onCancel={() => { setShowUicPrompt(false); doStart(); }}
      />

      <Modal open={!!inProgress} onClose={() => setInProgress(null)} title="Inspection already in progress">
        {inProgress && (
          <p className="text-text-secondary text-sm mb-4">
            You have an unfinished inspection of <span className="font-display font-bold text-text-primary">{inProgress.bumperNumber}</span> from {inProgress.date}. Resume it, or discard it and start this one?
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={handleResumeExisting}>Resume it</Button>
          <Button variant="danger" fullWidth onClick={handleDiscardExisting}>Discard it and start new</Button>
          <Button variant="ghost" fullWidth onClick={() => setInProgress(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  );
}
