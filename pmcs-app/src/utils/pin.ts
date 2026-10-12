import { ApiError, isNetworkError } from './api';

export const NEW_PIN_RE = /^\d{6,12}$/;

/** Field-level checks for a PIN change. Returns an error per field, empty when valid. */
export function validatePinChange(current: string, next: string, confirm: string): { current?: string; next?: string; confirm?: string } {
  const errors: { current?: string; next?: string; confirm?: string } = {};
  if (!/^\d{4,12}$/.test(current)) errors.current = 'Enter your current PIN (digits only).';
  if (!NEW_PIN_RE.test(next)) errors.next = 'New PIN must be 6 to 12 digits.';
  else if (next === current) errors.next = 'Choose a PIN different from the current one.';
  if (!errors.next && confirm !== next) errors.confirm = "The PINs don't match.";
  return errors;
}

/** Soldier-facing message for a failed change-pin call. */
export function changePinErrorMessage(err: unknown, temporary: boolean): string {
  if (isNetworkError(err)) {
    return "Can't reach the server. Connect to the internet and try again. Your saved inspections stay on this phone.";
  }
  if (err instanceof ApiError) {
    // The API answers a wrong current PIN with 403 INVALID_PIN (401 tolerated for older servers).
    if (err.code === 'INVALID_PIN' || err.status === 401) {
      return temporary
        ? "That temporary PIN isn't right. Check the PIN your admin gave you."
        : "Your current PIN isn't right. Try again.";
    }
    if (err.status === 429) return err.message || 'Too many tries. Wait a few minutes and try again.';
    if (err.status === 400) return err.message || 'New PIN must be 6 to 12 digits.';
    return err.message || `PIN not changed (${err.status}).`;
  }
  return 'PIN not changed. Try again.';
}
