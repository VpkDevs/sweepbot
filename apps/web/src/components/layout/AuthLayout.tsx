import { Outlet, Link } from '@tanstack/react-router'
import { Zap } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col noise relative overflow-hidden">
      {/* Ambient backgrounds */}
      <div className="fixed inset-0 mesh-gradient-auth pointer-events-none" />
      <div className="fixed inset-0 dot-grid opacity-20 pointer-events-none" />

      {/* Morphing blobs */}
      <div className="fixed pointer-events-none inset-0">
        <div className="blob blob-brand w-[500px] h-[500px] top-[-10%] left-[20%] opacity-25" />
        <div className="blob blob-accent w-[400px] h-[400px] bottom-[5%] right-[15%] opacity-15" />
        <div className="blob blob-warm w-[300px] h-[300px] top-[40%] left-[-5%] opacity-10" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 lg:px-8 py-5 animate-fade-in-down z-10">
        <Link to="/sign-in" className="flex items-center gap-2.5 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-xl shadow-brand-500/25">
            <Zap className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-brand-400/20 animate-glow-pulse" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">SweepBot</span>
        </Link>
        <Link
          to="/pricing"
          className="text-sm text-zinc-400 hover:text-white transition-colors font-medium gradient-underline"
        >
          Pricing
        </Link>
      </header>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-12 z-10">
        <div className="w-full max-w-sm animate-reveal-up [animation-delay:100ms]">
          <Outlet />
        </div>
      </div>

      {/* Footer */}
      <footer className="relative px-6 py-4 text-center z-10 animate-fade-in [animation-delay:400ms]">
        <p className="text-xs text-zinc-600">
          SweepBot is a transparency and productivity tool. Not a gambling product.{' '}
          <a href="#" className="hover:text-zinc-400 underline underline-offset-2 transition-colors">
            Terms
          </a>{' '}
          ·{' '}
          <a href="#" className="hover:text-zinc-400 underline underline-offset-2 transition-colors">
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
