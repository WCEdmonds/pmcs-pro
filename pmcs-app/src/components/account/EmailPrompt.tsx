import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, X } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { isEmailPromptSnoozed, snoozeEmailPrompt } from '../../utils/email';
import { useOnline } from '../../hooks/useOnline';
import { Button } from '../ui/Button';
import { EmailCodeForm } from './EmailCodeForm';

/**
 * Home-screen nudge to add or confirm the email used for self-service PIN reset.
 * Only online, with a fresh profile from the server; "Not now" hides it for 7 days.
 * Never blocks anything.
 */
export function EmailPrompt() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const offlineProfile = useUserStore((s) => s.offlineProfile);
  const online = useOnline();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  // `email` is undefined when the server doesn't support email yet: say nothing then.
  if (!user || !online || offlineProfile || user.mustChangePin || user.email === undefined) return null;
  const email = user.email;
  if (email && user.emailVerifiedAt) return null;
  if (dismissedFor === user.dodId || isEmailPromptSnoozed(user.dodId)) return null;

  const dismiss = () => {
    snoozeEmailPrompt(user.dodId);
    setDismissedFor(user.dodId);
  };

  return (
    <section
      className="bg-accent-blue/10 border border-accent-blue/30 rounded-[var(--radius-lg)] p-4 mb-4"
      aria-labelledby="email-prompt-heading"
      data-testid="email-prompt"
    >
      <div className="flex items-start gap-3">
        <Mail size={22} className="text-accent-blue flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="email-prompt-heading" className="text-sm font-semibold text-text-primary">
            {email ? 'Confirm your email' : 'Add your email'}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5 break-words">
            {email
              ? <>Enter the code we sent to {email}.</>
              : 'Add your email so you can reset your PIN yourself.'}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="-mt-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3">
        {email ? (
          <EmailCodeForm idPrefix="prompt-email" />
        ) : (
          <Button fullWidth onClick={() => navigate('/settings', { state: { focus: 'email' } })}>
            Add Email
          </Button>
        )}
      </div>
    </section>
  );
}
