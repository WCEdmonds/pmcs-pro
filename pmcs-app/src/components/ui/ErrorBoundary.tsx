import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
          <AlertTriangle size={48} className="text-accent-amber" />
          <h2 className="text-lg font-bold font-display text-text-primary">
            {this.props.fallbackMessage || 'Something went wrong'}
          </h2>
          <p className="text-sm text-text-secondary max-w-sm">
            Your inspection data is saved locally. Tap below to reload.
          </p>
          <button
            onClick={this.handleReload}
            className="min-h-[48px] px-6 bg-accent-blue text-white rounded-[var(--radius-md)] font-medium"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
