import { useRef, useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { CODE_RE, codeDigits, emailErrorMessage, needsNewCode } from '../../utils/email';
import { useOnline } from '../../hooks/useOnline';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface EmailCodeFormProps {
  idPrefix: string;
  onVerified?: () => void;
  autoFocus?: boolean;
}

/** "Enter code" + "Resend code" for the signed-in soldier's unconfirmed email. */
export function EmailCodeForm({ idPrefix, onVerified, autoFocus }: EmailCodeFormProps) {
  const verifyEmail = useUserStore((s) => s.verifyEmail);
  const resendEmailCode = useUserStore((s) => s.resendEmailCode);
  const online = useOnline();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offerNewCode, setOfferNewCode] = useState(false);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const busyRef = useRef(false);

  const run = async (kind: 'verify' | 'resend', fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setError('');
    setNotice('');
    setOfferNewCode(false);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleVerify = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!CODE_RE.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    void run('verify', async () => {
      try {
        await verifyEmail(code);
        setCode('');
        onVerified?.();
      } catch (err) {
        setError(emailErrorMessage(err, 'Email not confirmed. Try again.'));
        setOfferNewCode(needsNewCode(err));
      }
    });
  };

  const handleResend = () => run('resend', async () => {
    try {
      await resendEmailCode();
      setCode('');
      setNotice('New code sent. It expires in 15 minutes.');
    } catch (err) {
      setError(emailErrorMessage(err, 'Code not sent. Try again.'));
    }
  });

  return (
    <form onSubmit={handleVerify} noValidate className="flex flex-col gap-2" aria-busy={!!busy}>
      <Input
        id={`${idPrefix}-code`}
        label="6-digit code"
        value={code}
        onChange={(e) => setCode(codeDigits(e.target.value))}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
      />
      {notice && <p className="text-sm text-accent-green" role="status">{notice}</p>}
      {error && <p className="text-sm text-accent-red" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={offerNewCode ? 'primary' : 'secondary'}
          fullWidth
          onClick={handleResend}
          disabled={!!busy || !online}
        >
          {busy === 'resend' ? 'Sending…' : offerNewCode ? 'Send a new code' : 'Resend code'}
        </Button>
        <Button type="submit" fullWidth disabled={!!busy || !online || !code}>
          {busy === 'verify' ? 'Checking…' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
}
