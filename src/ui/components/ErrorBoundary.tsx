import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** React error boundaries must be class components — there is no hook equivalent. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in page:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-3xl p-6">
        <h1 className="mb-2 text-lg font-semibold text-negative">{this.props.fallbackTitle ?? 'Something went wrong'}</h1>
        <p className="mb-4 text-sm text-muted">{error.message}</p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink hover:bg-hairline"
        >
          Try again
        </button>
      </div>
    );
  }
}
