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
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Authentication failed</h2>
        <p className="text-sm text-zinc-400">{error}</p>
        <button
          onClick={() => navigate({ to: '/sign-in' })}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm text-center space-y-4">
      <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center mx-auto">
        <Zap className="w-5 h-5 text-white" />
      </div>
      <div className="flex items-center justify-center gap-2 text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Completing sign-in…</span>
      </div>
    </div>
  )
}
