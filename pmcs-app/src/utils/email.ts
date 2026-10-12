import { ApiError, isNetworkError } from './api';

/** Light client-side check; the server has the final say. */
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export function isLikelyEmail(value: string): boolean {
  const s = value.trim();
  return s.length <= 254 && EMAIL_RE.test(s);
}

/** Emailed codes are 6 digits. */
export const CODE_RE = /^\d{6}$/;

/** Shown after a PIN-reset code was requested (the server never says whether one was sent). */
export const CODE_SENT_NOTICE =
  "If this account has a confirmed email, we sent a 6-digit code. It expires in 15 minutes. No email? Ask your unit's PMCS Pro admin to reset your PIN.";

export const codeDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Codes the API uses when an emailed code can't be used any more (a new one is needed). */
export function needsNewCode(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'CODE_LOCKED' || err.code === 'CODE_EXPIRED');
}

/** Soldier-facing message for a failed email / code call. */
export function emailErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isNetworkError(err)) return "Can't reach the server. Connect to the internet and try again.";
  if (err instanceof ApiError) {
    if (err.code === 'CODE_INVALID' && err.message === 'Incorrect code') return "That code isn't right. Check the email and try again.";
    return err.message || `${fallback} (${err.status})`;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// "Add / confirm your email" prompt: dismissing it snoozes it for 7 days per soldier
// (devices are shared).
// ---------------------------------------------------------------------------

export const EMAIL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const snoozeKey = (dodId: string) => `pmcs-email-prompt-snooze:${dodId}`;

export function isEmailPromptSnoozed(dodId: string, now = Date.now()): boolean {
  try {
    const until = Number(localStorage.getItem(snoozeKey(dodId)) || 0);
    return until > now;
  } catch {
    return false;
  }
}

export function snoozeEmailPrompt(dodId: string, now = Date.now()) {
  try {
    localStorage.setItem(snoozeKey(dodId), String(now + EMAIL_PROMPT_SNOOZE_MS));
  } catch {
    // Storage unavailable — the prompt is hidden for this page load only
  }
}
