import { useEffect, useState } from 'react';
import { Input } from './Input';
import { validateUic, lookupUic, type UicLookup } from '../../utils/uicLookup';

interface UicFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  /** Called with the lookup result whenever it changes (null while invalid/checking). */
  onLookup?: (lookup: UicLookup | null) => void;
}

/**
 * UIC input used everywhere a UIC is entered: uppercases, requires 6
 * alphanumerics, offers a one-tap O→0 fix, and shows the unit name.
 */
export function UicField({ value, onChange, label = 'UIC (Unit Identification Code)', id = 'uic', onLookup }: UicFieldProps) {
  const v = validateUic(value);
  const [touched, setTouched] = useState(false);
  const [lookup, setLookup] = useState<{ uic: string; result: UicLookup } | null>(null);

  useEffect(() => {
    if (!v.valid) return;
    let cancelled = false;
    const t = setTimeout(() => {
      lookupUic(v.value).then((result) => {
        if (!cancelled) setLookup({ uic: v.value, result });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [v.valid, v.value]);

  const current = v.valid && lookup?.uic === v.value ? lookup.result : null;
  useEffect(() => {
    onLookup?.(current);
  }, [current, onLookup]);

  const showError = (touched || value.length >= 6) && !!v.error;

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
        onBlur={() => setTouched(true)}
        placeholder="e.g., WABC12"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={10}
        error={showError ? v.error : undefined}
        aria-describedby={`${id}-help`}
      />
      <div id={`${id}-help`} className="flex flex-col gap-1" aria-live="polite">
        {v.suggestion && v.suggestion !== v.value && (
          <div className="flex items-center gap-2 text-sm text-accent-amber">
            <span>Letter O found. Did you mean 0 (zero)?</span>
            <button
              type="button"
              onClick={() => onChange(v.suggestion!)}
              className="min-h-[36px] px-2 rounded-[var(--radius-sm)] border border-accent-amber text-accent-amber font-display"
            >
              Use {v.suggestion}
            </button>
          </div>
        )}
        {v.valid && !current && <p className="text-xs text-text-secondary">Checking UIC…</p>}
        {current?.status === 'known' && (
          <p className="text-sm text-accent-green" data-testid="uic-known">
            <span className="font-display font-bold">{v.value}</span> — {current.unitName}
          </p>
        )}
        {current?.status === 'new' && (
          <p className="text-sm text-accent-amber" data-testid="uic-new">New UIC — check it's correct</p>
        )}
        {current?.status === 'unavailable' && (
          <p className="text-xs text-text-secondary">Couldn't check this UIC right now — make sure it's correct.</p>
        )}
      </div>
    </div>
  );
}
