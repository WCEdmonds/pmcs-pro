import { useId } from 'react';
import { pinDigits } from '../../utils/pin';
import { Input } from '../ui/Input';

interface NewPinFieldsProps {
  idPrefix: string;
  next: string;
  confirm: string;
  onNextChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  errors: { next?: string; confirm?: string };
  /** Extra sentence after "6 to 12 digits." */
  hintExtra?: string;
}

/** "New PIN" + "Confirm New PIN" inputs (digits only, 6–12) with the shared hint. */
export function NewPinFields({ idPrefix, next, confirm, onNextChange, onConfirmChange, errors, hintExtra }: NewPinFieldsProps) {
  const hintId = useId();
  return (
    <>
      <Input
        id={`${idPrefix}-new`}
        label="New PIN"
        value={next}
        onChange={(e) => onNextChange(pinDigits(e.target.value))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        error={errors.next}
        aria-invalid={!!errors.next}
        aria-describedby={hintId}
      />
      <p id={hintId} className="text-xs text-text-secondary -mt-1">
        6 to 12 digits.{hintExtra ? ` ${hintExtra}` : ''}
      </p>
      <Input
        id={`${idPrefix}-confirm`}
        label="Confirm New PIN"
        value={confirm}
        onChange={(e) => onConfirmChange(pinDigits(e.target.value))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        error={errors.confirm}
        aria-invalid={!!errors.confirm}
      />
    </>
  );
}
