import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../../stores/auth'
import { Zap, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'

export function SignInPage() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn(email, password)
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-7">
      {/* Logo + heading */}
      <div className="flex flex-col items-center gap-4 animate-fade-in-up">
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-2xl shadow-brand-500/30">
          <Zap className="w-7 h-7 text-white" />
          <div className="absolute inset-0 rounded-2xl bg-brand-400/20 animate-glow-pulse" />
          {/* Outer glow ring */}
          <div className="absolute -inset-2 rounded-3xl bg-brand-500/10 animate-breathe" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-zinc-500 mt-1.5 text-pretty">Sign in to your SweepBot account</p>
        </div>
      </div>

      {/* Google OAuth */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 glass-card rounded-xl text-white text-sm font-semibold transition-all hover:bg-zinc-800/80 disabled:opacity-50 disabled:cursor-not-allowed press-scale shine-on-hover animate-fade-in-up [animation-delay:60ms]"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        Continue with Google
      </button>

      <div className="relative animate-fade-in [animation-delay:120ms]">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
        <div className="relative flex justify-center text-[10px]">
          <span className="px-4 bg-zinc-950 text-zinc-600 uppercase tracking-widest font-semibold">or continue with email</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm animate-spring-in flex items-start gap-2">
          <span className="text-red-400 mt-0.5">✕</span>
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up [animation-delay:150ms]">
        <div>
          <label htmlFor="email" className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.15em]">
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
            className="w-full px-4 py-3 glass-input text-white placeholder-zinc-600 rounded-xl text-sm focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[11px] text-brand-400 hover:text-brand-300 transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 glass-input text-white placeholder-zinc-600 rounded-xl text-sm focus:outline-none pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="group w-full px-4 py-3 btn-primary text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-brand-500/20 hover:shadow-brand-500/30"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 animate-fade-in [animation-delay:300ms]">
        Don&apos;t have an account?{' '}
        <Link to="/sign-up" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors gradient-underline">
          Create one free
        </Link>
      </p>
    </div>
  )
}
