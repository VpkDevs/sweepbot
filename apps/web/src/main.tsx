import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import './index.css'
import { routeTree } from './routeTree'
import { useAuthStore } from './stores/auth'
import { ErrorBoundary } from './components/ErrorBoundary'

// analytics & monitoring
import posthog from 'posthog-js'
import * as Sentry from '@sentry/react'

// Initialize PostHog only when analytics is enabled AND a key is configured.
// VITE_ENABLE_ANALYTICS guards the feature flag; VITE_POSTHOG_KEY provides the key.
if (import.meta.env.VITE_ENABLE_ANALYTICS !== 'false' && import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
    // capture_pageview is fired manually below via router subscription
    capture_pageview: false,
  })
}

// Initialize Sentry for error monitoring
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    // only sample a small percentage in dev/demo
    tracesSampleRate: import.meta.env.DEV ? 0.01 : 0.1,
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s stale time — data is fresh enough for analytics
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: undefined!, // populated in RouterProvider wrapper
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function App() {
  const auth = useAuthStore()

  // pageview tracking: tanstack-router emits location changes
  useEffect(() => {
    const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS !== 'false'
    if (analyticsEnabled && import.meta.env.VITE_POSTHOG_KEY && posthog) {
      const unsub = router.subscribe('onResolved', () => {
        posthog.capture('$pageview', { path: router.state.location.pathname })
      })
      return () => unsub()
    }
  }, [])

  return (
    // Our custom ErrorBoundary with better UX + Sentry integration
    <ErrorBoundary>
      <RouterProvider router={router} context={{ queryClient, auth }} />
    </ErrorBoundary>
  )
}

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
