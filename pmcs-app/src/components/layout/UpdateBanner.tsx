import { useEffect, useState } from 'react';
import { isUpdateReady, onUpdateReady } from '../../utils/pwa';

export function UpdateBanner() {
  const [ready, setReady] = useState(isUpdateReady());
  useEffect(() => onUpdateReady(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[70] bg-accent-blue text-white text-sm px-4 py-2 flex items-center justify-between gap-2 pt-[calc(8px+env(safe-area-inset-top))]">
      <span>App update ready. Your inspection is saved.</span>
      <button onClick={() => window.location.reload()} className="min-h-[36px] px-3 rounded bg-white/20 font-semibold">Reload</button>
    </div>
  );
}
