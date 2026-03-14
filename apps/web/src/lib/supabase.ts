import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// In development, allow the app to run without Supabase configured
// by creating a mock client that won't cause hangs.
// VITE_DEV_STUB=true bypasses auth regardless of which Supabase URL is configured —
// this lets .env.local carry real credentials for the API while still previewing the UI.
const isDevStub =
  import.meta.env.DEV &&
  (supabaseUrl?.includes('placeholder') || import.meta.env.VITE_DEV_STUB === 'true')

if (!isDevStub && (!supabaseUrl || !supabaseAnonKey)) {
  if (import.meta.env.DEV) {
    console.warn(
      '⚠️  Supabase environment variables are missing. Running in stub mode for development.'
    )
  } else {
    throw new Error('Missing Supabase environment variables. Check your .env file.')
  }
}

export const supabase = (!isDevStub && supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sweepbot-auth',
      },
      // Add timeout to prevent hanging
      global: {
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000), // 10 second timeout
          }),
      },
    })
  : null

// Stub auth methods when Supabase is not configured
export const supabaseStub = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signInWithOAuth: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
}

// Use stub in development if Supabase is not configured
export const supabaseClient = supabase || supabaseStub
