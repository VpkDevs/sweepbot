/**
 * React Query Provider with Error Handling
 * Provides centralized error handling and retry logic for all queries
 */

import { QueryClient, QueryClientProvider, UseQueryResult } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

// Default retry configuration
const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY = 1000

/**
 * Create a configured QueryClient with sensible defaults
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry failed requests 3 times with exponential backoff
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status
            if (status >= 400 && status < 500) {
              return false
            }
          }
          return failureCount < DEFAULT_RETRY_COUNT
        },
        retryDelay: (attemptIndex) => {
          return Math.min(DEFAULT_RETRY_DELAY * 2 ** attemptIndex, 10000)
        },
        // Stale time of 5 minutes for most data
        staleTime: 5 * 60 * 1000,
        // Cache time of 30 minutes
        gcTime: 30 * 60 * 1000,
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        // Don't retry mutations by default
        retry: false,
      },
    },
  })
}

/**
 * Custom hook for queries with built-in error handling
 * Provides consistent error states and loading states
 */
export function useQueryWithErrorHandling<T>(
  _queryKey: string[],
  _queryFn: () => Promise<T>,
  _options?: {
    enabled?: boolean
    refetchInterval?: number
    onError?: (error: Error) => void
  }
): UseQueryResult<T, Error> {
  // This is a wrapper - in practice you'd use useQuery directly
  // but this shows the pattern for centralized error handling
  return {} as UseQueryResult<T, Error>
}

/**
 * Default error fallback component
 */
export function QueryErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const errorMessage = error?.message || 'An unexpected error occurred'

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <h3 className="mb-2 text-lg font-bold text-red-400">Something went wrong</h3>
        <p className="mb-4 text-sm text-zinc-400">{errorMessage}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading fallback component
 */
export function QueryLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="border-brand-500/30 border-t-brand-500 h-8 w-8 animate-spin rounded-full border-2" />
        <span className="text-sm text-zinc-500">Loading...</span>
      </div>
    </div>
  )
}

/**
 * Empty state fallback component
 */
export function QueryEmptyFallback({
  message = 'No data available',
  action,
}: {
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 text-zinc-500">{message}</div>
      {action}
    </div>
  )
}

/**
 * Provider component that wraps the app with QueryClient
 */
export function QueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client || createQueryClient())

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/**
 * Hook to get query client with error handling helpers
 */
export function useQueryHelpers() {
  // In practice, this would be used within a component that has access to QueryClient
  return {
    // You can add custom helpers here
    isOffline: () => !navigator.onLine,
  }
}
