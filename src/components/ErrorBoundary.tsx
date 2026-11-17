import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../services/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { source: 'react-error-boundary', componentStack: info.componentStack ?? '' });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
          <p className="eyebrow">Something went wrong</p>
          <h1 style={{ margin: '8px 0 12px' }}>This page hit an unexpected fault.</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            The error was reported to the app’s local telemetry boundary. Try reloading, or return
            to the catalog.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
