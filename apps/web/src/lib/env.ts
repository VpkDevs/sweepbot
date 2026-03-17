/**
 * Web App Environment Variable Validation
 * Validates client-side environment variables at runtime
 * Provides type-safe access to environment variables
 */

import { z } from 'zod'

const webEnvSchema = z.object({
  // API Configuration
  VITE_API_URL: z.string().min(1).default('/api/v1'),
  
  // Supabase Configuration
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  
  // Feature Flags
  VITE_ENABLE_ANALYTICS: z.enum(['true', 'false']).default('true'),
  VITE_ENABLE_DEBUG: z.enum(['true', 'false']).default('false'),
  VITE_ENABLE_EXPERIMENTAL_FEATURES: z.enum(['true', 'false']).default('false'),
  
  // Third-party Services
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
  
  // App Configuration
  VITE_APP_NAME: z.string().default('SweepBot'),
  VITE_APP_URL: z.string().url().default('https://app.sweepbot.app'),
})

type WebEnv = z.infer<typeof webEnvSchema>

let parsedEnv: WebEnv | null = null

/**
 * Validate and get the web app environment variables
 * Call this early in app initialization to fail fast
 * @returns The validated environment variables
 * @throws If environment variables are invalid
 */
export function validateWebEnv(): WebEnv {
  if (parsedEnv) {
    return parsedEnv
  }

  const result = webEnvSchema.safeParse(import.meta.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    console.error('❌ Invalid environment variables:')
    Object.entries(errors).forEach(([key, messages]) => {
      console.error(`  ${key}: ${messages?.join(', ')}`)
    })
    throw new Error('Environment validation failed. Check console for details.')
  }

  parsedEnv = result.data
  return parsedEnv
}

/**
 * Get a validated environment variable
 * Uses cached result after first call
 */
export function getWebEnv(): WebEnv {
  if (!parsedEnv) {
    return validateWebEnv()
  }
  return parsedEnv
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(feature: keyof Pick<WebEnv, 'VITE_ENABLE_ANALYTICS' | 'VITE_ENABLE_DEBUG' | 'VITE_ENABLE_EXPERIMENTAL_FEATURES'>): boolean {
  const env = getWebEnv()
  return env[feature] === 'true'
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV === true
}

/**
 * Check if we're in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD === true
}

/**
 * Check if we're running in production build
 */
export function isBuild(): boolean {
  return import.meta.env.MODE === 'production'
}

// Export individual env values for convenience
export const env = {
  get apiUrl() { return getWebEnv().VITE_API_URL },
  get supabaseUrl() { return getWebEnv().VITE_SUPABASE_URL },
  get supabaseAnonKey() { return getWebEnv().VITE_SUPABASE_ANON_KEY },
  get enableAnalytics() { return isFeatureEnabled('VITE_ENABLE_ANALYTICS') },
  get enableDebug() { return isFeatureEnabled('VITE_ENABLE_DEBUG') },
  get enableExperimental() { return isFeatureEnabled('VITE_ENABLE_EXPERIMENTAL_FEATURES') },
  get sentryDsn() { return getWebEnv().VITE_SENTRY_DSN },
  get posthogKey() { return getWebEnv().VITE_POSTHOG_KEY },
  get appName() { return getWebEnv().VITE_APP_NAME },
  get appUrl() { return getWebEnv().VITE_APP_URL },
  isDevelopment,
  isProduction,
  isBuild,
}

