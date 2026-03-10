import { Outlet, Link, useRouter, useMatches } from '@tanstack/react-router'
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
  Award,
  CalendarDays,
  Star,
  Bot,
  ChevronRight,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/auth'
import { cn } from '../../lib/utils'
import { NotificationPanel } from '../ui/NotificationPanel'
import { OnboardingTour } from '../ui/OnboardingTour'
import { CursorGlow } from '../fx/CursorGlow'
import { NoiseOverlay } from '../fx/NoiseOverlay'
import { ErrorBoundary } from '../ErrorBoundary'

const navSections = [
  {
    label: 'Core',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/sessions', label: 'Sessions', icon: Zap },
      { to: '/platforms', label: 'Platforms', icon: Gamepad2 },
      { to: '/analytics', label: 'Analytics', icon: LineChart },
      { to: '/jackpots', label: 'Jackpots', icon: Trophy },
      { to: '/redemptions', label: 'Redemptions', icon: Banknote },
      { to: '/trust-index', label: 'Trust Index', icon: ShieldCheck },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/flows', label: 'SweepBot Flows', icon: Bot },
    ],
  },
  {
    label: 'Engage',
    items: [
      { to: '/achievements', label: 'Achievements', icon: Award },
      { to: '/heatmap', label: 'Heatmap', icon: CalendarDays },
      { to: '/records', label: 'Records', icon: Star },
      { to: '/big-wins', label: 'Big Wins', icon: Trophy },
    ],
  },
] as const

const TIER_CONFIG = {
  elite:   { cls: 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/25', label: 'Elite', ring: 'ring-brand-500/30' },
  analyst: { cls: 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20', label: 'Analyst', ring: 'ring-purple-500/20' },
  pro:     { cls: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20', label: 'Pro', ring: 'ring-blue-500/20' },
  starter: { cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20', label: 'Starter', ring: 'ring-emerald-500/20' },
  free:    { cls: 'bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50', label: 'Free', ring: 'ring-zinc-700/30' },
} as const

// Map route paths to breadcrumb labels
const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/sessions': 'Sessions',
  '/platforms': 'Platforms',
  '/analytics': 'Analytics',
  '/jackpots': 'Jackpots',
  '/redemptions': 'Redemptions',
  '/trust-index': 'Trust Index',
  '/flows': 'SweepBot Flows',
  '/achievements': 'Achievements',
  '/heatmap': 'Heatmap',
  '/records': 'Records',
  '/big-wins': 'Big Wins',
  '/settings': 'Settings',
  '/pricing': 'Pricing',
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Night owl mode 🦉'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Night owl mode 🦉'
}

/**
 * Render the application's shell with responsive sidebar, topbar, and main content outlet.
 *
 * Renders a collapsible navigation sidebar (including tier badge, nav links, user controls),
 * a header containing the menu toggle and NotificationPanel, and an Outlet for nested routes.
 *
 * @returns The root JSX element for the app layout containing the sidebar, header, and page content.
 */

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { user, tier, signOut } = useAuthStore()
  const router = useRouter()
  const matches = useMatches()

  const handleSignOut = async () => {
    await signOut()
    router.navigate({ to: '/sign-in' })
  }

  const tierCfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.free

  // Current route for breadcrumb
  const currentPath = matches[matches.length - 1]?.pathname ?? '/'
  const currentLabel = ROUTE_LABELS[currentPath] ?? currentPath.split('/').pop()

  return (
    <div className="flex h-screen overflow-hidden">
      <OnboardingTour />
      {/* ─── Global FX layers ─────────────────────────────────── */}
      <CursorGlow size={700} color="rgba(139, 92, 246, 0.06)" />
      <NoiseOverlay opacity={0.014} animate />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="gradient-mesh-premium absolute inset-0" />
        <div className="blob blob-brand w-[600px] h-[600px] -top-[200px] -left-[200px] opacity-20" />
        <div className="blob blob-accent w-[400px] h-[400px] bottom-[10%] right-[5%] opacity-15" />
        {/* Floating particles */}
        <div className="floating-particles">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={cn('particle', `particle-${i}`)}
            />
          ))}
        </div>
      </div>


      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 modal-backdrop lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col glass-sidebar transition-all duration-300 ease-out lg:static',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-5 py-5 transition-all', collapsed && 'px-3 justify-center')}>
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25 flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
            <div className="absolute inset-0 rounded-xl bg-brand-400/20 animate-glow-pulse" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-white tracking-tight animate-fade-in">SweepBot</span>
          )}
          <button
            className={cn('lg:hidden text-zinc-400 hover:text-white transition-colors', collapsed ? 'hidden' : 'ml-auto')}
            onClick={() => setMobileOpen(false)}
            type="button"
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tier badge */}
        {!collapsed && (
          <div className="px-5 pb-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide', tierCfg.cls)}>
                {tierCfg.label}
              </span>
              {tier === 'free' && (
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors group gradient-underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Upgrade
                  <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mx-3" />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-3">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 shine-on-hover',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                      'text-zinc-400 hover:text-white hover:bg-white/[0.04]',
                      '[&.active]:text-white [&.active]:bg-brand-500/[0.08] [&.active]:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]'
                    )}
                    activeProps={{ className: 'active' }}
                    activeOptions={{ exact: to === '/' }}
                    {...(collapsed ? { 'data-tooltip': label } : {})}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0 transition-colors [.active_&]:text-brand-400" />
                    {!collapsed && label}
                    {!collapsed && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 opacity-0 [.active_&]:opacity-100 transition-opacity shadow-sm shadow-brand-400/50" />
                    )}
                    {/* Active bar indicator */}
                    <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600 opacity-0 [.active_&]:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mx-3" />

        {/* Bottom section */}
        <div className="px-2 py-2 space-y-0.5">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            {collapsed ? <PanelLeft className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
            {!collapsed && 'Collapse'}
          </button>

          <Link
            to="/settings"
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
            )}
          >
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && 'Settings'}
          </Link>
          <button
            onClick={handleSignOut}
            className={cn(
              'flex items-center gap-3 w-full rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>

          {/* User row */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-3 mt-1 animate-fade-in">
              <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-2 ring-brand-500/10">
                <span className="text-[11px] font-bold text-white uppercase">
                  {user?.email?.charAt(0) ?? '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main content ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-6 h-14 glass-panel shrink-0 z-10">
          <button
            className="lg:hidden text-zinc-400 hover:text-white transition-colors press-scale"
            onClick={() => setMobileOpen(true)}
            type="button"
            title="Open navigation"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb / Page title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 hidden sm:inline">{getGreeting()}</span>
            <span className="text-zinc-700 hidden sm:inline">·</span>
            <span className="text-zinc-300 font-medium">{currentLabel}</span>
          </div>

          <div className="flex-1" />

          {/* Search trigger (placeholder for future) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-zinc-600 text-sm cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.06] transition-all">
            <span className="text-xs">⌘K</span>
            <span className="text-zinc-600">Search...</span>
          </div>

          <NotificationPanel />
        </header>

        {/* Glow accent line */}
        <div className="glow-line shrink-0" />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
