import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { useSessionStore } from '../stores/sessionStore';
import { useUnsynced } from '../hooks/useSync';
import { ChangePinForm } from '../components/account/ChangePinForm';
import { Button } from '../components/ui/Button';

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/**
 * Full-screen lock shown while the server requires a new PIN (an admin reset it and
 * handed out a temporary one). Nothing else in the app is reachable until it's done.
 * Inspections on the phone are untouched and send once the PIN is changed.
 */
export default function SetNewPinPage() {
  const user = useUserStore((s) => s.user);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const unsent = useUnsynced(user?.dodId)?.sessions.length ?? 0;

  const handleSignOut = () => {
    useSessionStore.getState().clearSession();
    useUserStore.getState().signOut();
  };

  return (
    <main className="flex flex-col h-full px-4 overflow-y-auto" aria-labelledby="set-pin-heading">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-center max-w-sm">
          <h1 id="set-pin-heading" className="text-3xl font-bold font-display text-text-primary tracking-tight">
            Set a new PIN
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            Your unit's PMCS Pro admin reset your PIN. Enter the temporary PIN they gave you, then choose
            your own new PIN.
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          {!online && (
            <p className="flex items-start gap-2 text-sm text-accent-amber" role="status">
              <WifiOff size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              You're offline. Connect to the internet to set your new PIN.
            </p>
          )}
          {unsent > 0 && (
            <p className="text-sm text-text-secondary" role="status" data-testid="set-pin-unsent">
              {unsent} inspection{unsent === 1 ? ' is' : 's are'} saved on this phone and will send once your new PIN is set.
            </p>
          )}
          <ChangePinForm temporary idPrefix="set-pin" submitLabel="Set New PIN" autoFocus />
          <Button variant="ghost" fullWidth onClick={handleSignOut}>
            Not you? Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
