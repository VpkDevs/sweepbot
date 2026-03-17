import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabaseClient } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth'
import { Zap, Loader2, AlertTriangle } from 'lucide-react'

/**
 * Handles all Supabase OAuth/magic-link/password-recovery callbacks.
 * Supabase redirects here with an access_token in the URL hash.
 * We exchange the tokens and route the user appropriately.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      // Supabase parses the hash fragment automatically on getSession()
      const { data, error: sessionError } = await supabaseClient.auth.getSession()

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (data.session) {
        // Sync Zustand store
        await refreshSession()

        // Check if this is a password recovery flow
        const params = new URLSearchParams(window.location.search)
        const type = params.get('type')

        if (type === 'recovery') {
          // Redirect to settings so they can update password
          navigate({ to: '/settings' })
        } else {
          navigate({ to: '/' })
        }
      } else {
        // No session — something went wrong
        setError('Authentication failed. The link may have expired.')
      }
    }

    void handleCallback()
  }, [navigate, refreshSession])

  if (error) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-700 bg-red-900/40">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Authentication failed</h2>
        <p className="text-sm text-zinc-400">{error}</p>
        <button
          onClick={() => navigate({ to: '/sign-in' })}
          className="bg-brand-600 hover:bg-brand-500 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="bg-brand-600 mx-auto flex h-10 w-10 items-center justify-center rounded-xl">
        <Zap className="h-5 w-5 text-white" />
      </div>
      <div className="flex items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Completing sign-in…</span>
      </div>
    </div>
  )
}
