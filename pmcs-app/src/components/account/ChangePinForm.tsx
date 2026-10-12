import { useId, useRef, useState } from 'react';
import { changePinErrorMessage, validatePinChange } from '../../utils/pin';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12);

interface ChangePinFormProps {
  /** The current PIN is a temporary one an admin gave the soldier. */
  temporary?: boolean;
  submitLabel?: string;
  idPrefix: string;
  onDone?: () => void;
  autoFocus?: boolean;
}

export function ChangePinForm({ temporary = false, submitLabel = 'Change PIN', idPrefix, onDone, autoFocus }: ChangePinFormProps) {
  const changePin = useUserStore((s) => s.changePin);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validatePinChange>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const hintId = useId();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy.current) return;
    const errors = validatePinChange(current, next, confirm);
    setFieldErrors(errors);
    setError('');
    if (errors.current || errors.next || errors.confirm) return;
    busy.current = true;
    setSaving(true);
    try {
      await changePin(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      onDone?.();
    } catch (err) {
      setError(changePinErrorMessage(err, temporary));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3" aria-busy={saving}>
      <Input
        id={`${idPrefix}-current`}
        label={temporary ? 'Temporary PIN' : 'Current PIN'}
        value={current}
        onChange={(e) => setCurrent(digits(e.target.value))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus={autoFocus}
        error={fieldErrors.current}
        aria-invalid={!!fieldErrors.current}
      />
      <Input
        id={`${idPrefix}-new`}
        label="New PIN"
        value={next}
        onChange={(e) => setNext(digits(e.target.value))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        error={fieldErrors.next}
        aria-invalid={!!fieldErrors.next}
        aria-describedby={hintId}
      />
      <p id={hintId} className="text-xs text-text-secondary -mt-1">
        6 to 12 digits{temporary ? ". Don't reuse the temporary PIN." : '.'}
      </p>
      <Input
        id={`${idPrefix}-confirm`}
        label="Confirm New PIN"
        value={confirm}
        onChange={(e) => setConfirm(digits(e.target.value))}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        error={fieldErrors.confirm}
        aria-invalid={!!fieldErrors.confirm}
      />
      {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
      <Button type="submit" fullWidth disabled={saving || !current || !next || !confirm}>
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
