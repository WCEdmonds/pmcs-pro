import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useSessionStore } from '../../stores/sessionStore';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const currentSession = useSessionStore((s) => s.currentSession);
  const showNav = !currentSession || currentSession.status !== 'IN_PROGRESS';

  return (
    <div className="h-full flex flex-col">
      <main className={`flex-1 overflow-y-auto ${showNav ? 'pb-[calc(56px+env(safe-area-inset-bottom))]' : ''}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
