import { AlertTriangle, RefreshCw } from 'lucide-react'

/** Full-page error with a Retry button (shown when there is no data to fall back on). */
export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-bg-secondary border border-accent-red/40 rounded-xl p-8 max-w-xl">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-6 h-6 text-accent-red" />
        <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      <p className="text-sm text-text-secondary mb-5">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  )
}

/** Banner shown when a background refresh failed but older data is still on screen. */
export function StaleBanner({ message, updatedAt, onRetry }: { message: string; updatedAt: number | null; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 px-4 py-3 bg-accent-amber/10 border border-accent-amber/40 rounded-lg text-sm">
      <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0" />
      <span className="text-text-primary flex-1">
        Couldn't refresh: {message}
        {updatedAt && (
          <span className="text-text-secondary"> Showing data from {new Date(updatedAt).toLocaleTimeString()}.</span>
        )}
      </span>
      <button onClick={onRetry} className="px-3 py-1 rounded-md bg-bg-tertiary text-text-primary text-xs font-medium hover:bg-bg-tertiary/70">
        Retry
      </button>
    </div>
  )
}

/** Inline error for a failed action (Acknowledge, Resolve, Save...). */
export function ActionError({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-center gap-3 px-4 py-3 bg-accent-red/10 border border-accent-red/40 rounded-lg text-sm">
      <AlertTriangle className="w-4 h-4 text-accent-red flex-shrink-0" />
      <span className="text-text-primary flex-1">{message}</span>
      <button onClick={onDismiss} className="text-xs text-text-secondary hover:text-text-primary">
        Dismiss
      </button>
    </div>
  )
}

export function StatusBadge({ status }: { status: string | null }) {
  if (status === 'FMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/20 text-accent-green">FMC</span>
  if (status === 'PMC') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
  if (status === 'DEADLINE') return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">DEADLINE</span>
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
}

export function ReadinessBadge({ readiness }: { readiness: string | null }) {
  if (readiness === 'NMC') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-red/20 text-accent-red">NMC</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-amber/20 text-accent-amber">PMC</span>
}
