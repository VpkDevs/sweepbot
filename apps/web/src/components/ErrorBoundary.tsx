/**
 * React Error Boundary
 * Catches runtime errors in component tree and displays fallback UI
 * Integrates with Sentry for error reporting
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { logger } from '@sweepbot/utils'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    logger.error('ErrorBoundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    // Report to Sentry in production
    if (import.meta.env.PROD) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }

    // Custom error handler
    this.props.onError?.(error, errorInfo)
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      // Default fallback UI
      return (
        <div className="bg-background flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md space-y-4 text-center">
            <div className="bg-destructive/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <svg
                className="text-destructive h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold">Something went wrong</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                An unexpected error occurred. Please try refreshing the page.
              </p>

              {import.meta.env.DEV && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium">
                    Error details (dev only)
                  </summary>
                  <pre className="bg-muted mt-2 overflow-auto rounded p-4 text-xs">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex justify-center gap-2">
              <button
                onClick={this.resetError}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="border-input bg-background hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based error boundary for specific components
 * Usage: const { ErrorBoundary, reset } = useErrorBoundary()
 */
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null)

  const reset = React.useCallback(() => {
    setError(null)
  }, [])

  if (error) {
    throw error
  }

  return {
    ErrorBoundary: ({ children, fallback }: Omit<Props, 'onError'>) => (
      <ErrorBoundary fallback={fallback} onError={setError}>
        {children}
      </ErrorBoundary>
    ),
    reset,
  }
}
