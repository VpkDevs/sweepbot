import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthState } from './stores/auth'

// ── Root layout ──────────────────────────────────────────────────────────────
import { AppShell } from './components/layout/AppShell'
import { AuthLayout } from './components/layout/AuthLayout'

// ── Pages ────────────────────────────────────────────────────────────────────
import { DashboardPage } from './pages/DashboardPage'
import { PlatformsPage } from './pages/PlatformsPage'
import { PlatformDetailPage } from './pages/PlatformDetailPage'
import { SessionsPage } from './pages/SessionsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { JackpotsPage } from './pages/JackpotsPage'
import { RedemptionsPage } from './pages/RedemptionsPage'
import { TrustIndexPage } from './pages/TrustIndexPage'
import { SettingsPage } from './pages/SettingsPage'
import { PricingPage } from './pages/PricingPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { HeatmapPage } from './pages/HeatmapPage'
import { RecordsPage } from './pages/RecordsPage'
import { BigWinsPage } from './pages/BigWinsPage'
import { FlowsPage } from './pages/FlowsPage'
import { FlowChatPage } from './pages/FlowChatPage'
import { FlowDetailPage } from './pages/FlowDetailPage'
import { TosMonitorPage } from './pages/TosMonitorPage'
import { TaxCenterPage } from './pages/TaxCenterPage'
import { SignInPage } from './pages/auth/SignInPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage'

export interface RouterContext {
  queryClient: QueryClient
  auth: AuthState
}

// ── Root route ────────────────────────────────────────────────────────────────
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
})

// ── Auth routes (unauthenticated layout) ──────────────────────────────────────
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  component: AuthLayout,
})

const signInRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-in',
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-up',
  component: SignUpPage,
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallbackPage,
})

// ── Public route ─────────────────────────────────────────────────────────────
const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pricing',
  component: PricingPage,
})

// ── Protected routes (AppShell layout) ───────────────────────────────────────
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppShell,
  beforeLoad: async ({ context }) => {
    await context.auth.refreshSession()
    // In dev with stub mode active (placeholder URL or VITE_DEV_STUB=true),
    // skip auth so the UI is previewable without real credentials.
    const isDevStub =
      import.meta.env.DEV &&
      (import.meta.env.VITE_SUPABASE_URL?.includes('placeholder') ||
        import.meta.env.VITE_DEV_STUB === 'true')
    if (!context.auth.user && !isDevStub) {
      throw redirect({ to: '/sign-in' })
    }
  },
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})

const platformsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/platforms',
  component: PlatformsPage,
})

const platformDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/platforms/$platformId',
  component: PlatformDetailPage,
})

const sessionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sessions',
  component: SessionsPage,
})

const analyticsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/analytics',
  component: AnalyticsPage,
})

const jackpotsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/jackpots',
  component: JackpotsPage,
})

const redemptionsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/redemptions',
  component: RedemptionsPage,
})

const trustIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/trust-index',
  component: TrustIndexPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
})

const achievementsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/achievements',
  component: AchievementsPage,
})

const heatmapRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/heatmap',
  component: HeatmapPage,
})

const recordsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/records',
  component: RecordsPage,
})

const bigWinsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/big-wins',
  component: BigWinsPage,
})

const flowsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/flows',
  component: FlowsPage,
})

const flowChatRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/flows/new',
  component: FlowChatPage,
})

const flowDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/flows/$flowId',
  component: FlowDetailPage,
})

const tosMonitorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tos-monitor',
  component: TosMonitorPage,
})

const taxCenterRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/tax-center',
  component: TaxCenterPage,
})

// ── Route tree assembly ───────────────────────────────────────────────────────
export const routeTree = rootRoute.addChildren([
  authRoute.addChildren([signInRoute, signUpRoute, forgotPasswordRoute]),
  authCallbackRoute,
  pricingRoute,
  appRoute.addChildren([
    dashboardRoute,
    platformsRoute,
    platformDetailRoute,
    sessionsRoute,
    analyticsRoute,
    jackpotsRoute,
    redemptionsRoute,
    trustIndexRoute,
    settingsRoute,
    achievementsRoute,
    heatmapRoute,
    recordsRoute,
    bigWinsRoute,
    flowsRoute,
    flowChatRoute,
    flowDetailRoute,
    tosMonitorRoute,
    taxCenterRoute,
  ]),
])
