import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, Settings, Truck } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useUnsynced } from '../../hooks/useSync';

const tabs: Array<{ path: string; icon: typeof Home; label: string; disabled?: boolean }> = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/fleet', icon: Truck, label: 'Fleet', disabled: true },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const dodId = useUserStore((s) => s.user?.dodId);
  const unsent = useUnsynced(dodId)?.sessions.length ?? 0;

  return (
    <nav aria-label="Main" className="fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label, disabled }) => {
          const isActive = !disabled && location.pathname === path;
          const badge = path === '/history' && unsent > 0 ? unsent : 0;
          return (
            <button
              key={path}
              onClick={() => !disabled && navigate(path)}
              disabled={disabled}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px]
                ${isActive ? 'text-accent-blue' : disabled ? 'text-text-secondary/40' : 'text-text-secondary'}
                ${disabled ? 'cursor-not-allowed' : ''}
              `}
              aria-label={badge ? `${label}, ${badge} not sent` : label}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
              {badge > 0 && (
                <span aria-hidden="true" className="absolute top-0.5 right-1 min-w-4 h-4 px-1 bg-accent-amber text-[9px] font-bold text-black rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
