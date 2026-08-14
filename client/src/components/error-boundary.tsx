import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  retryCount: number;
  autoRetrying: boolean;
  countdown: number;
  isChunkError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

// Stale deployment: old HTML referencing chunks that no longer exist on the server.
function isChunkLoadError(error?: Error): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    error.name === 'ChunkLoadError'
  );
}

// Network/transient errors that should auto-retry (e.g. during deployment restarts)
function isNetworkError(error?: Error): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to load') ||
    isChunkLoadError(error)
  );
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0, autoRetrying: false, countdown: 0, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.logErrorToServer(error, errorInfo);

    if (isChunkLoadError(error)) {
      // Stale deployment — old HTML trying to load chunks that no longer exist.
      // Hard-reload once to get fresh HTML with current chunk URLs.
      const reloadKey = 'chunk-error-reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return;
      }
      // Already reloaded once — clear flag and show error UI to avoid infinite loop.
      sessionStorage.removeItem(reloadKey);
    } else if (isNetworkError(error) && this.state.retryCount < 3) {
      this.startAutoRetry();
    }
  }

  startAutoRetry() {
    const delay = 5; // seconds
    this.setState({ autoRetrying: true, countdown: delay });

    this.countdownInterval = setInterval(() => {
      this.setState(prev => {
        if (prev.countdown <= 1) {
          clearInterval(this.countdownInterval!);
          this.countdownInterval = null;
          return { countdown: 0, autoRetrying: false };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);

    setTimeout(() => {
      this.setState(prev => ({
        hasError: false,
        error: undefined,
        retryCount: prev.retryCount + 1,
        autoRetrying: false,
        countdown: 0,
        isChunkError: false,
      }));
    }, delay * 1000);
  }

  componentWillUnmount() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  logErrorToServer = async (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: error.message, name: error.name, stack: error.stack },
          errorInfo: { componentStack: errorInfo.componentStack },
          page: window.location.pathname,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }),
      });
    } catch {
      // Silently ignore logging failures
    }
  };

  retry = () => {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.state.isChunkError) {
      // Chunk errors can only be fixed by a hard reload to get fresh HTML
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: undefined, autoRetrying: false, countdown: 0, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      const { autoRetrying, countdown, isChunkError } = this.state;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="text-center max-w-md mx-auto">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isChunkError ? 'New version available' : 'Something went wrong'}
            </h2>
            <p className="text-gray-600 mb-6">
              {autoRetrying
                ? `Reconnecting automatically in ${countdown}s...`
                : isChunkError
                ? 'The app was updated. Click below to reload and get the latest version.'
                : 'We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.'}
            </p>
            <Button
              onClick={this.retry}
              className="min-h-[44px] flex items-center gap-2 mx-auto"
              data-testid="button-retry-error"
            >
              <RefreshCw className={`h-4 w-4 ${autoRetrying ? 'animate-spin' : ''}`} />
              {autoRetrying ? 'Retry Now' : isChunkError ? 'Reload App' : 'Try Again'}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
