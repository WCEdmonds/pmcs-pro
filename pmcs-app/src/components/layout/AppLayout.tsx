import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

const NAV_ROUTES = new Set(['/', '/history', '/settings']);

/** The bottom nav is shown by route (never by in-memory session state). */
export function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useLocation();
  const showNav = NAV_ROUTES.has(pathname);

  return (
    <div className="h-full flex flex-col">
      <main className={`flex-1 overflow-y-auto ${showNav ? 'pb-[calc(56px+env(safe-area-inset-bottom))]' : ''}`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
