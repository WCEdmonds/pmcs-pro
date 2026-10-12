import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mail, X } from 'lucide-react'
import { useUnits } from '../hooks/useUnits'

const SNOOZE_KEY = 'pmcs-dashboard-email-prompt-until'
export const EMAIL_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

function snoozeKey(userId: string) {
  return `${SNOOZE_KEY}:${userId}`
}

/** True while an earlier "Remind me later" (stored per user, this browser) is still in effect. */
function isSnoozed(userId: string): boolean {
  let until = 0
  try {
    until = Number(localStorage.getItem(snoozeKey(userId)) ?? 0) || 0
  } catch {
    // Storage unavailable: treat as not snoozed
  }
  return until > Date.now()
}

/**
 * Asks signed-in users without a confirmed email to add one, so they can reset
 * their own PIN. "Remind me later" hides it for 7 days (per user, this browser).
 */
export function EmailPromptBanner() {
  const { profile } = useUnits()
  const { pathname } = useLocation()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  // `email` is absent (undefined) from API versions without email support: say nothing then.
  if (!profile || profile.email === undefined) return null
  const hasEmail = !!profile.email
  if (hasEmail && profile.email_verified_at) return null
  if (pathname === '/settings') return null
  if (dismissedFor === profile.id || isSnoozed(profile.id)) return null

  function dismiss() {
    if (!profile) return
    try {
      localStorage.setItem(snoozeKey(profile.id), String(Date.now() + EMAIL_PROMPT_SNOOZE_MS))
    } catch {
      // Storage unavailable: hide for this page load only
    }
    setDismissedFor(profile.id)
  }

  return (
    <div role="region" aria-label="Add your email" data-testid="email-prompt"
      className="flex items-center gap-3 mb-6 px-4 py-3 bg-accent-blue/10 border border-accent-blue/40 rounded-lg text-sm">
      <Mail className="w-4 h-4 text-accent-blue flex-shrink-0" />
      <span className="text-text-primary flex-1">
        {hasEmail
          ? 'Confirm your email so you can reset your own PIN if you forget it.'
          : 'Add a personal email so you can reset your own PIN if you forget it.'}{' '}
        <Link to="/settings#email" className="font-medium text-accent-blue hover:underline">
          {hasEmail ? 'Confirm email in Settings' : 'Add email in Settings'}
        </Link>
      </span>
      <button type="button" onClick={dismiss} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
        <X className="w-3 h-3" />
        Remind me later
      </button>
    </div>
  )
}
