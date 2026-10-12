import { useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { emailErrorMessage, isLikelyEmail } from '../../utils/email';
import { useOnline } from '../../hooks/useOnline';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmailCodeForm } from './EmailCodeForm';

/**
 * Settings → Email: the personal email used for self-service PIN reset. Add / change /
 * remove it, and confirm it with the emailed code. Needs the internet; the cached profile
 * shows the last known state offline.
 */
export function EmailSettings() {
  const user = useUserStore((s) => s.user);
  const setEmail = useUserStore((s) => s.setEmail);
  const removeEmail = useUserStore((s) => s.removeEmail);
  const online = useOnline();
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (!user) return null;
  const email = user.email ?? null;
  const confirmed = !!email && !!user.emailVerifiedAt;
  const editing = mode === 'edit' || !email;

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = draft.trim();
    if (!isLikelyEmail(value)) {
      setDraftError('Enter a valid email address');
      return;
    }
    setDraftError('');
    void run(async () => {
      try {
        const sent = await setEmail(value);
        const after = useUserStore.getState().user;
        setMode('view');
        setDraft('');
        if (after?.emailVerifiedAt) setStatus({ kind: 'ok', text: 'This email is already confirmed.' });
        else if (sent) setStatus({ kind: 'ok', text: `We sent a 6-digit code to ${after?.email ?? value}. It expires in 15 minutes.` });
        else setStatus({ kind: 'error', text: 'Email saved, but too many codes were requested. Try "Resend code" in an hour.' });
      } catch (err) {
        setStatus({ kind: 'error', text: emailErrorMessage(err, 'Email not saved. Try again.') });
      }
    });
  };

  const handleRemove = () => run(async () => {
    try {
      await removeEmail();
      setMode('view');
      setStatus({ kind: 'ok', text: 'Email removed.' });
    } catch (err) {
      setStatus({ kind: 'error', text: emailErrorMessage(err, 'Email not removed. Try again.') });
    }
  });

  return (
    <div className="flex flex-col gap-3" data-testid="email-settings">
      <p className="text-xs text-text-secondary">
        Used only to reset a forgotten PIN yourself. A .mil or personal address both work.
      </p>

      {!online && (
        <p className="flex items-start gap-2 text-sm text-accent-amber" role="status">
          <WifiOff size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          You're offline. Connect to the internet to change your email.
        </p>
      )}

      {email && (
        <div className="flex items-center justify-between gap-2 bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3">
          <span className="text-sm text-text-primary break-all" data-testid="email-current">{email}</span>
          <Badge variant={confirmed ? 'green' : 'amber'} className="flex-shrink-0">
            {confirmed ? 'Confirmed' : 'Not confirmed'}
          </Badge>
        </div>
      )}

      {status && (
        <p className={`text-sm ${status.kind === 'ok' ? 'text-accent-green' : 'text-accent-red'}`} role={status.kind === 'ok' ? 'status' : 'alert'}>
          {status.text}
        </p>
      )}

      {email && !confirmed && mode === 'view' && (
        <>
          <p className="text-sm text-text-secondary">Enter the code we emailed to confirm this address.</p>
          <EmailCodeForm
            idPrefix="settings-email"
            onVerified={() => setStatus({ kind: 'ok', text: 'Email confirmed. You can now reset your PIN yourself.' })}
          />
        </>
      )}

      {editing ? (
        <form onSubmit={handleSave} noValidate className="flex flex-col gap-2" aria-busy={busy}>
          <Input
            id="settings-email"
            label={email ? 'New email' : 'Email'}
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            error={draftError || undefined}
          />
          <div className="flex gap-2">
            {email && (
              <Button type="button" variant="secondary" fullWidth onClick={() => { setMode('view'); setDraftError(''); }} disabled={busy}>
                Cancel
              </Button>
            )}
            <Button type="submit" fullWidth disabled={busy || !online || !draft.trim()}>
              {busy ? 'Saving…' : email ? 'Save Email' : 'Add Email'}
            </Button>
          </div>
        </form>
      ) : mode === 'remove' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-accent-amber" role="alert">
            Remove this email? You won't be able to reset a forgotten PIN yourself.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setMode('view')} disabled={busy}>Keep</Button>
            <Button variant="danger" fullWidth onClick={handleRemove} disabled={busy || !online}>
              {busy ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => { setStatus(null); setDraft(''); setMode('edit'); }} disabled={!online}>
            Change Email
          </Button>
          <Button variant="secondary" fullWidth onClick={() => { setStatus(null); setMode('remove'); }} disabled={!online}>
            Remove Email
          </Button>
        </div>
      )}
    </div>
  );
}
