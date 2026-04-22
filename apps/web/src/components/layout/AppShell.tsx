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
  FileText,
  Scale,
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
    label: 'Intelligence',
    items: [
      { to: '/tos-monitor', label: 'TOS Monitor', icon: FileText },
      { to: '/tax-center', label: 'Tax Center', icon: Scale },
    ],
  },
  {
    label: 'Automation',
    items: [{ to: '/flows', label: 'SweepBot Flows', icon: Bot }],
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
  elite: {
    cls: 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-lg shadow-brand-500/25',
    label: 'Elite',
    ring: 'ring-brand-500/30',
  },
  analyst: {
    cls: 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/20',
    label: 'Analyst',
    ring: 'ring-purple-500/20',
  },
  pro: {
    cls: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20',
    label: 'Pro',
    ring: 'ring-blue-500/20',
  },
  starter: {
    cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
    label: 'Starter',
    ring: 'ring-emerald-500/20',
  },
  free: {
    cls: 'bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/50',
    label: 'Free',
    ring: 'ring-zinc-700/30',
  },
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
  '/tos-monitor': 'TOS Monitor',
  '/tax-center': 'Tax Center',
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
      <div className="pointer-events-none fixed inset-0">
        <div className="gradient-mesh-premium absolute inset-0" />
        <div className="blob blob-brand -left-[200px] -top-[200px] h-[600px] w-[600px] opacity-20" />
        <div className="blob blob-accent bottom-[10%] right-[5%] h-[400px] w-[400px] opacity-15" />
        {/* Floating particles */}
        <div className="floating-particles">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={cn('particle', `particle-${i}`)} />
          ))}
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="modal-backdrop animate-fade-in fixed inset-0 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'glass-sidebar fixed inset-y-0 left-0 z-30 flex flex-col overflow-y-auto transition-all duration-300 ease-out lg:static',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center gap-3 px-5 py-5 transition-all',
            collapsed && 'justify-center px-3'
          )}
        >
          <div className="from-brand-500 to-brand-700 shadow-brand-500/25 relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg">
            <Zap className="h-4 w-4 text-white" />
            <div className="bg-brand-400/20 animate-glow-pulse absolute inset-0 rounded-xl" />
          </div>
          {!collapsed && (
            <span className="animate-fade-in text-lg font-bold tracking-tight text-white">
              SweepBot
            </span>
          )}
          <button
            className={cn(
              'text-zinc-400 transition-colors hover:text-white lg:hidden',
              collapsed ? 'hidden' : 'ml-auto'
            )}
            onClick={() => setMobileOpen(false)}
            type="button"
            title="Close navigation"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tier badge */}
        {!collapsed && (
          <div className="animate-fade-in px-5 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide',
                  tierCfg.cls
                )}
              >
                {tierCfg.label}
              </span>
              {tier === 'free' && (
                <Link
                  to="/pricing"
                  className="text-brand-400 hover:text-brand-300 gradient-underline group inline-flex items-center gap-1 text-xs font-medium transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Upgrade
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      'shine-on-hover group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                      'text-zinc-400 hover:bg-white/[0.04] hover:text-white',
                      '[&.active]:bg-brand-500/[0.08] [&.active]:text-white [&.active]:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]'
                    )}
                    activeProps={{ className: 'active' }}
                    activeOptions={{ exact: to === '/' }}
                    {...(collapsed ? { 'data-tooltip': label } : {})}
                  >
                    <Icon className="[.active_&]:text-brand-400 h-[18px] w-[18px] flex-shrink-0 transition-colors" />
                    {!collapsed && label}
                    {!collapsed && (
                      <div className="bg-brand-400 shadow-brand-400/50 ml-auto h-1.5 w-1.5 rounded-full opacity-0 shadow-sm transition-opacity [.active_&]:opacity-100" />
                    )}
                    {/* Active bar indicator */}
                    <div className="from-brand-400 to-brand-600 absolute bottom-[20%] left-0 top-[20%] w-[3px] rounded-r-full bg-gradient-to-b opacity-0 transition-opacity [.active_&]:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Bottom section */}
        <div className="space-y-0.5 px-2 py-2">
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition-all hover:bg-white/[0.04] hover:text-white lg:flex"
          >
            {collapsed ? (
              <PanelLeft className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
            {!collapsed && 'Collapse'}
          </button>

          <Link
            to="/settings"
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-white',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2'
            )}
          >
            <Settings className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && 'Settings'}
          </Link>
          <button
            onClick={handleSignOut}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl text-sm font-medium text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-white',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2'
            )}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>

          {/* User row */}
          {!collapsed && (
            <div className="animate-fade-in mt-1 flex items-center gap-3 px-3 py-3">
              <div className="from-brand-500 to-brand-700 shadow-brand-500/20 ring-brand-500/10 relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ring-2">
                <span className="text-[11px] font-bold uppercase text-white">
                  {user?.email?.charAt(0) ?? '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-400">{user?.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main content ────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="glass-panel z-10 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6"
          role="banner"
        >
          <button
            className="press-scale focus:outline-brand-500 rounded-lg p-1 text-zinc-400 transition-colors hover:text-white focus:outline-2 focus:outline-offset-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
            title="Open navigation"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb / Page title */}
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden whitespace-nowrap text-zinc-600 sm:inline">
              {getGreeting()}
            </span>
            <span className="hidden text-zinc-700 sm:inline">·</span>
            <span className="truncate font-medium text-zinc-300">{currentLabel}</span>
          </div>

          <div className="flex-1" />

          {/* Search trigger (placeholder for future) */}
          <div className="focus-within:ring-brand-500/20 hidden cursor-pointer items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-600 transition-all focus-within:ring-2 hover:border-white/[0.06] hover:bg-white/[0.05] md:flex">
            <span className="text-xs">⌘K</span>
            <span className="hidden text-zinc-600 lg:inline">Search...</span>
          </div>

          <NotificationPanel />
        </header>

        {/* Glow accent line */}
        <div className="glow-line shrink-0" />

        {/* Page content */}
        <main
          className="focus:outline-brand-500 flex-1 overflow-y-auto scroll-smooth focus:outline-2 focus:outline-offset-0"
          id="main-content"
          role="main"
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* ─── Compliance disclaimer strip ─────────────────────────── */}
        {/* Required persistent notice: SweepBot is a data-tracking tool,
            not a gambling product. Historical data only. No advice given. */}
        <footer
          className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-white/[0.03] bg-zinc-950/80 px-4 py-1.5 backdrop-blur-sm"
          aria-label="Legal disclaimer"
        >
          <ShieldCheck className="h-3 w-3 flex-shrink-0 text-zinc-600" aria-hidden="true" />
          <p className="text-center text-[10px] leading-snug text-zinc-600">
            SweepBot is a data-tracking and transparency tool, not a gambling product or service.
            All data shown is historical and informational only. SweepBot does not provide gambling
            advice, predict outcomes, or recommend play strategies.{' '}
            <a
              href="https://sweepbot.app/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-zinc-400"
            >
              Terms
            </a>
            {' · '}
            <a
              href="https://sweepbot.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-zinc-400"
            >
              Privacy
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}
