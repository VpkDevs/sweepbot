import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
import { Zap, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Reset your password</h1>
        <p className="text-sm text-zinc-400 text-center">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <p className="text-sm text-zinc-400">
            Reset link sent to <span className="text-white font-medium">{email}</span>. Check your inbox.
          </p>
          <Link
            to="/sign-in"
            className="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send reset link
            </button>
          </form>

          <Link
            to="/sign-in"
            className="flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </>
      )}
    </div>
  )
}
