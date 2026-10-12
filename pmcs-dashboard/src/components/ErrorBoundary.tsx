import { Component, type ReactNode } from 'react'

/** Last-resort fallback (e.g. a code-split chunk failed to load) instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled UI error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-screen gap-4 bg-bg-primary text-center px-4">
        <p className="font-display text-lg text-text-primary">Something went wrong loading this page.</p>
        <p className="text-sm text-text-secondary">The dashboard may have been updated. Reloading usually fixes it.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90"
        >
          Reload
        </button>
      </div>
    )
  }
}
