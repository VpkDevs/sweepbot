/**
 * Quick Reference: Import Paths for New Infrastructure
 * Copy-paste these into your files as needed
 */

// ──────────────────────────────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────────────────────────────
import { logger, createLogger } from '@sweepbot/utils'

// Basic usage
logger.info('User action', { userId: '123' })
logger.error('Operation failed', { error: err.message })

// Scoped logger for a module
const moduleLogger = createLogger('SessionManager')
moduleLogger.debug('Session created', { sessionId: '456' })

// ──────────────────────────────────────────────────────────────────────
// Error Handling
// ──────────────────────────────────────────────────────────────────────
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Wrap route components
<ErrorBoundary>
  <YourPage />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary fallback={(error, reset) => (
  <CustomErrorUI error={error} onRetry={reset} />
)}>
  <YourComponent />
</ErrorBoundary>

// ──────────────────────────────────────────────────────────────────────
// Enhanced API Client
// ──────────────────────────────────────────────────────────────────────
import { api, ApiError, NetworkError } from '@/lib/api-enhanced'

// Basic usage (same as before)
const users = await api.user.profile()

// With retry config
const users = await request('/users', {
  retries: 5,
  timeout: 60000,
  retryDelay: 2000,
})

// Error handling
try {
  await api.user.updateProfile(data)
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // Redirect to login
  } else if (error instanceof NetworkError) {
    // Show offline message
  }
}

// ──────────────────────────────────────────────────────────────────────
// Performance Hooks
// ──────────────────────────────────────────────────────────────────────
import {
  useDebounce,
  useThrottle,
  usePerformanceMonitor,
  useIntersectionObserver,
  useSafeState,
} from '@/hooks/usePerformance'

// Debounced search
const debouncedSearch = useDebounce(searchFunction, 300)

// Throttled scroll handler
const throttledScroll = useThrottle(handleScroll, 100)

// Performance monitoring
usePerformanceMonitor('ExpensiveComponent')

// Lazy loading
const ref = useRef(null)
const isVisible = useIntersectionObserver(ref)
{isVisible && <HeavyComponent />}

// Safe async state
const [data, setData] = useSafeState(null)

// ──────────────────────────────────────────────────────────────────────
// Validation Schemas
// ──────────────────────────────────────────────────────────────────────
import {
  loginSchema,
  userProfileSchema,
  sessionSchema,
} from '@sweepbot/types/validation'

// Form validation
const result = loginSchema.safeParse(formData)
if (!result.success) {
  console.error(result.error.flatten())
}

// API validation
const body = createSessionSchema.parse(request.body) // throws

// Type inference
type LoginForm = z.infer<typeof loginSchema>

// ──────────────────────────────────────────────────────────────────────
// Database Query Helpers
// ──────────────────────────────────────────────────────────────────────
import {
  cachedQuery,
  batchOperation,
  monitoredQuery,
  paginatedQuery,
  transaction,
} from '@/db/query-helpers'

// Cached query
const users = await cachedQuery(
  'users:list',
  () => db.select().from(users),
  { ttl: 300 }
)

// Monitored query
const result = await monitoredQuery(
  'expensive-analytics-query',
  () => db.query.complexAnalytics(),
  1000 // Warn if > 1s
)

// Paginated query
const result = await paginatedQuery(
  () => db.select({ count: count() }).from(users),
  (offset, limit) => db.select().from(users).limit(limit).offset(offset),
  { page: 1, limit: 20 }
)

// Transaction
await transaction(async () => {
  await db.insert(users).values(user)
  await db.insert(profiles).values(profile)
  // Auto-rollback on error
})

// ──────────────────────────────────────────────────────────────────────
// Environment Config
// ──────────────────────────────────────────────────────────────────────
// API (Node.js)
import { env } from '@/utils/env'
const port = env.PORT // number, validated

// Web/Extension (Vite)
const apiUrl = import.meta.env.VITE_API_URL

// All env vars are validated on startup, app crashes if missing

// ──────────────────────────────────────────────────────────────────────
// Quick Wins
// ──────────────────────────────────────────────────────────────────────

// Replace ALL console.log with logger
- console.log('User logged in', user)
+ logger.info('User logged in', { userId: user.id })

// Wrap top-level routes
- <Switch><Route path="/" component={Home} /></Switch>
+ <ErrorBoundary><Switch><Route path="/" component={Home} /></Switch></ErrorBoundary>

// Add debounce to search inputs
- <input onChange={(e) => search(e.target.value)} />
+ <input onChange={(e) => debouncedSearch(e.target.value)} />

// Validate API input
- const body = request.body
+ const body = createUserSchema.parse(request.body)

// Cache expensive queries
- const stats = await db.select().from(analytics).where(...)
+ const stats = await cachedQuery('dashboard:stats', () => db.select()...)

// Monitor slow queries
- const results = await db.query.complex()
+ const results = await monitoredQuery('complex-query', () => db.query.complex())

// ──────────────────────────────────────────────────────────────────────
// Common Patterns
// ──────────────────────────────────────────────────────────────────────

// Don't repeat yourself - create scoped loggers
const sessionLogger = createLogger('SessionManager', { component: 'backend' })
sessionLogger.info('Session started')
sessionLogger.error('Session failed')

// Chain error boundaries for granular recovery
<ErrorBoundary> {/* App-level */}
  <Layout>
    <ErrorBoundary> {/* Route-level */}
      <Dashboard>
        <ErrorBoundary> {/* Component-level */}
          <ExpensiveWidget />
        </ErrorBoundary>
      </Dashboard>
    </ErrorBoundary>
  </Layout>
</ErrorBoundary>

// Combine performance hooks
const debouncedSearch = useDebounce((term) => {
  logger.info('Search executed', { term })
  searchAPI(term)
}, 300)

// Validate + log in API routes
export async function POST(request: Request) {
  try {
    const body = createUserSchema.parse(await request.json())
    logger.info('User creation request', { email: body.email })
    
    const user = await createUser(body)
    
    logger.info('User created', { userId: user.id })
    return { success: true, data: user }
  } catch (error) {
    logger.error('User creation failed', { error })
    throw error
  }
}
