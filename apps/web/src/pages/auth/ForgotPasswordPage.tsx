import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabaseClient } from '../../lib/supabase'
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
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
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
        <div className="bg-brand-600 flex h-10 w-10 items-center justify-center rounded-xl">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">Reset your password</h1>
        <p className="text-center text-sm text-zinc-400">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-green-700 bg-green-900/40">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <p className="text-sm text-zinc-400">
            Reset link sent to <span className="font-medium text-white">{email}</span>. Check your
            inbox.
          </p>
          <Link
            to="/sign-in"
            className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">
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
                className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-transparent focus:outline-none focus:ring-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-500 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>
          </form>

          <Link
            to="/sign-in"
            className="flex items-center justify-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </>
      )}
    </div>
  )
}
