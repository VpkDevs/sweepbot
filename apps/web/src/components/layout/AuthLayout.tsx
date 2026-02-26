import { Outlet, Link } from '@tanstack/react-router'
import { Zap } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/sign-in" className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">SweepBot</span>
        </Link>
        <Link
          to="/pricing"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Pricing
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-zinc-600">
          SweepBot is a transparency and productivity tool. Not a gambling product.{' '}
          <a href="#" className="hover:text-zinc-400 underline underline-offset-2">
            Terms
          </a>{' '}
          ·{' '}
          <a href="#" className="hover:text-zinc-400 underline underline-offset-2">
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
