import { Outlet, Link } from '@tanstack/react-router'
import { Zap } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="noise relative flex min-h-screen flex-col overflow-hidden bg-zinc-950">
      {/* Ambient backgrounds */}
      <div className="mesh-gradient-auth pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-20" />

      {/* Morphing blobs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="blob blob-brand left-[20%] top-[-10%] h-[500px] w-[500px] opacity-25" />
        <div className="blob blob-accent bottom-[5%] right-[15%] h-[400px] w-[400px] opacity-15" />
        <div className="blob blob-warm left-[-5%] top-[40%] h-[300px] w-[300px] opacity-10" />
      </div>

      {/* Header */}
      <header className="animate-fade-in-down relative z-10 flex items-center justify-between px-6 py-5 lg:px-8">
        <Link to="/sign-in" className="group flex items-center gap-2.5">
          <div className="from-brand-500 to-brand-700 shadow-brand-500/25 relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-xl">
            <Zap className="h-5 w-5 text-white" />
            <div className="bg-brand-400/20 animate-glow-pulse absolute inset-0 rounded-xl" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">SweepBot</span>
        </Link>
        <Link
          to="/pricing"
          className="gradient-underline text-sm font-medium text-zinc-400 transition-colors hover:text-white"
        >
          Pricing
        </Link>
      </header>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="animate-reveal-up w-full max-w-sm [animation-delay:100ms]">
          <Outlet />
        </div>
      </div>

      {/* Footer */}
      <footer className="animate-fade-in relative z-10 px-6 py-4 text-center [animation-delay:400ms]">
        <p className="text-xs text-zinc-600">
          SweepBot is a transparency and productivity tool. Not a gambling product.{' '}
          <a
            href="#"
            className="underline underline-offset-2 transition-colors hover:text-zinc-400"
          >
            Terms
          </a>{' '}
          ·{' '}
          <a
            href="#"
            className="underline underline-offset-2 transition-colors hover:text-zinc-400"
          >
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
