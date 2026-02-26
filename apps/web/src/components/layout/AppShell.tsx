import { Outlet, Link, useRouter } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Gamepad2,
  LineChart,
  Trophy,
  Banknote,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Bell,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/auth'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/platforms', label: 'Platforms', icon: Gamepad2 },
  { to: '/sessions', label: 'Sessions', icon: Zap },
  { to: '/analytics', label: 'Analytics', icon: LineChart },
  { to: '/jackpots', label: 'Jackpots', icon: Trophy },
  { to: '/redemptions', label: 'Redemptions', icon: Banknote },
  { to: '/trust-index', label: 'Trust Index', icon: ShieldCheck },
] as const

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, tier, signOut } = useAuthStore()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.navigate({ to: '/sign-in' })
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-zinc-900 border-r border-zinc-800 transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">SweepBot</span>
          <button
            className="ml-auto lg:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tier badge */}
        <div className="px-6 py-3 border-b border-zinc-800">
          <span className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            tier === 'elite' ? 'bg-brand-600 text-white' :
            tier === 'analyst' ? 'bg-purple-600/20 text-purple-300' :
            tier === 'pro' ? 'bg-blue-600/20 text-blue-300' :
            tier === 'starter' ? 'bg-green-600/20 text-green-300' :
            'bg-zinc-700 text-zinc-300'
          )}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </span>
          {tier === 'free' && (
            <Link
              to="/pricing"
              className="ml-2 text-xs text-brand-400 hover:text-brand-300 font-medium"
            >
              Upgrade →
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'text-zinc-400 hover:text-white hover:bg-zinc-800',
                '[&.active]:text-white [&.active]:bg-zinc-800 [&.active]:text-brand-400'
              )}
              activeProps={{ className: 'active' }}
              activeOptions={{ exact: to === '/' }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign out
          </button>
          {/* User avatar */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center">
              <span className="text-xs font-bold text-white uppercase">
                {user?.email?.charAt(0) ?? '?'}
              </span>
            </div>
            <span className="text-xs text-zinc-500 truncate">{user?.email}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
          <button
            className="lg:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <button className="relative text-zinc-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            {/* Notification dot */}
            <span className="absolute top-0 right-0 block w-1.5 h-1.5 rounded-full bg-brand-500" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
