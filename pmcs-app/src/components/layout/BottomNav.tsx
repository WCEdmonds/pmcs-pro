import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, Settings, Truck } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { getPendingSyncCount } from '../../utils/syncQueue';

const tabs: Array<{ path: string; icon: typeof Home; label: string; disabled?: boolean }> = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/fleet', icon: Truck, label: 'Fleet', disabled: true },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentSession = useSessionStore((s) => s.currentSession);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    getPendingSyncCount().then(setPendingSync);
    const interval = setInterval(() => getPendingSyncCount().then(setPendingSync), 10000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Hide during active PMCS session
  if (currentSession && currentSession.status === 'IN_PROGRESS') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label, disabled }) => {
          const isActive = !disabled && location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => !disabled && navigate(path)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px]
                ${isActive ? 'text-accent-blue' : disabled ? 'text-text-secondary/30' : 'text-text-secondary'}
                ${disabled ? 'cursor-not-allowed' : ''}
              `}
              aria-label={label}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
              {path === '/' && pendingSync > 0 && (
                <span className="absolute top-0.5 right-1 w-4 h-4 bg-accent-amber text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                  {pendingSync}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
