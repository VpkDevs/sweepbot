import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Trophy,
  Clock,
  Gamepad2,
  ArrowUpRight,
  Sparkles,
  Target,
  Activity,
  Star,
  Flame,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../lib/api'
import { formatSC, formatRTP, timeAgo, cn } from '../lib/utils'
import { usePerformanceMonitor } from '../hooks/usePerformance'
import { StreakWidget } from '../components/ui/StreakWidget'
import { DailyStreakWidget } from '../components/dashboard/DailyStreakWidget'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { MarqueeStrip, MarqueeItem } from '../components/fx/MarqueeStrip'
import { AnimatedCounter, AnimatedValue } from '../components/fx/AnimatedCounter'
import { MagneticButton } from '../components/fx/MagneticButton'

// ── Time-based greeting ──────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil?'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Burning the midnight oil?'
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * Render the Command Center dashboard showing portfolio analytics, a 7-day activity chart,
 * jackpot statistics, and a platform performance table.
 *
 * While portfolio data is loading, renders DashboardSkeleton. Data for analytics and
 * jackpots is fetched internally and used to populate stat cards, the activity chart,
 * the Jackpot Tracker panel, and the platform breakdown table.
 *
 * @returns The React element containing the Command Center dashboard UI.
 */
export function DashboardPage() {
  usePerformanceMonitor('DashboardPage')

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => api.analytics.portfolio(),
  })

  const { data: jackpotStats } = useQuery({
    queryKey: ['jackpots', 'stats'],
    queryFn: () => api.jackpots.stats(),
  })

  if (isLoading) return <DashboardSkeleton />

  const totals = (portfolio as Record<string, Record<string, number>>)?.totals ?? {}
  const recentActivity = (portfolio as Record<string, unknown[]>)?.recentActivity ?? []
  const platformBreakdown = (portfolio as Record<string, unknown[]>)?.platformBreakdown ?? []

  const rtp = totals['overall_rtp'] ?? 0
  const rtpFormatted = formatRTP(rtp)
  const netProfit = totals['net_profit'] ?? 0
  const totalSessions = totals['total_sessions'] ?? 0
  const totalBets = totals['total_bets'] ?? 0
  const activePlatforms = totals['active_platforms'] ?? 0
  const hoursPlayed = totals['total_hours_played'] ?? 0

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-6 lg:p-8">
      {/* ─── Hero header ─────────────────────────────────────── */}
      <div className="glass-card-elevated aurora-bg liquid-glass relative overflow-hidden rounded-3xl p-6 lg:p-8">
        <div className="relative z-10">
          <p className="mb-1 text-sm text-zinc-500">{getGreeting()}</p>
          <TextReveal
            as="h1"
            className="heading-display text-shimmer text-3xl text-white lg:text-4xl"
            stagger={60}
            delay={100}
          >
            Command Center
          </TextReveal>
          <ScrollReveal delay={200} distance={20}>
            <p className="mt-2 max-w-lg text-pretty text-sm text-zinc-400">
              Your complete sweepstakes portfolio. Track performance, manage flows, and hit new
              records.
            </p>
          </ScrollReveal>

          {/* Quick stats bar */}
          <ScrollReveal delay={300} distance={20}>
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="glass-card-static holo-surface flex items-center gap-2 rounded-xl px-3 py-2">
                <div className="bg-brand-500/10 flex h-6 w-6 items-center justify-center rounded-lg">
                  <Sparkles className="text-brand-400 h-3 w-3" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Lifetime P&L</p>
                  <p
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    <AnimatedValue
                      value={netProfit}
                      prefix={netProfit >= 0 ? '+' : ''}
                      decimals={2}
                    />
                    <span className="ml-0.5 text-xs text-zinc-500">SC</span>
                  </p>
                </div>
              </div>
              <div className="glass-card-static holo-surface flex items-center gap-2 rounded-xl px-3 py-2">
                <div className="bg-brand-500/10 flex h-6 w-6 items-center justify-center rounded-lg">
                  <Target className="text-brand-400 h-3 w-3" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Sessions</p>
                  <p className="text-sm font-bold text-white">
                    <AnimatedCounter value={totalSessions} />
                  </p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* ─── Marquee stats ticker ──────────────────────────────── */}
      <ScrollReveal delay={100}>
        <MarqueeStrip speed={35} className="py-2">
          <MarqueeItem
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Total Sessions"
            value={String(totalSessions)}
          />
          <MarqueeItem
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Personal RTP"
            value={rtpFormatted.text}
          />
          <MarqueeItem
            icon={<Gamepad2 className="h-3.5 w-3.5" />}
            label="Platforms"
            value={String(activePlatforms)}
          />
          <MarqueeItem
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Hours Played"
            value={`${hoursPlayed.toFixed(1)}h`}
          />
          <MarqueeItem
            icon={<Trophy className="h-3.5 w-3.5" />}
            label="Total Bets"
            value={totalBets.toLocaleString()}
          />
          <MarqueeItem
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Net P&L"
            value={`${netProfit >= 0 ? '+' : ''}${formatSC(netProfit)} SC`}
          />
        </MarqueeStrip>
      </ScrollReveal>

      {/* ─── Streak widget ───────────────────────────────────── */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StreakWidget />
          <DailyStreakWidget />
        </div>
      </ScrollReveal>

      {/* ─── Bento stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ScrollReveal delay={0}>
          <StatCard
            label="Net P&L"
            value={netProfit}
            formatter={(v) => `${v >= 0 ? '+' : ''}${formatSC(v)} SC`}
            icon={netProfit >= 0 ? TrendingUp : TrendingDown}
            valueClass={netProfit >= 0 ? 'gradient-text-win' : 'text-loss'}
            sub={`${totalSessions} sessions played`}
            accentColor={netProfit >= 0 ? 'emerald' : 'red'}
          />
        </ScrollReveal>
        <ScrollReveal delay={60}>
          <StatCard
            label="Personal RTP"
            value={rtp}
            formatter={(v) => formatRTP(v).text}
            icon={Zap}
            valueClass={rtpFormatted.className}
            sub={`${totalBets.toLocaleString()} total bets`}
            accentColor="brand"
          />
        </ScrollReveal>
        <ScrollReveal delay={120}>
          <StatCard
            label="Platforms"
            value={activePlatforms}
            formatter={(v) => String(Math.round(v))}
            icon={Gamepad2}
            sub="actively tracked"
            accentColor="violet"
          />
        </ScrollReveal>
        <ScrollReveal delay={180}>
          <StatCard
            label="Hours Played"
            value={hoursPlayed}
            formatter={(v) => `${v.toFixed(1)}h`}
            icon={Clock}
            sub="all time"
            accentColor="blue"
          />
        </ScrollReveal>
      </div>

      {/* ─── Activity chart + Jackpot tracker ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 7-day chart */}
        <ScrollReveal delay={100} className="lg:col-span-2">
          <SpotlightCard
            className="glass-card h-full rounded-2xl p-6"
            spotlightColor="rgba(139, 92, 246, 0.06)"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                7-Day Activity
              </h2>
              <span className="rounded-lg bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-600">
                Last 7 days
              </span>
            </div>
            {recentActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={recentActivity as Record<string, number>[]}>
                  <defs>
                    <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(63, 63, 70, 0.2)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="play_date"
                    tick={{ fill: '#52525b', fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString('en', { weekday: 'short' })
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(9, 9, 11, 0.92)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 16px 48px -8px rgba(0,0,0,0.6)',
                      padding: '12px 16px',
                    }}
                    labelStyle={{ color: '#71717a', fontSize: 11, fontWeight: 600 }}
                    itemStyle={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}
                    cursor={{ stroke: 'rgba(139, 92, 246, 0.2)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="url(#netGradient)"
                    name="Net SC"
                    dot={{ fill: '#18181b', stroke: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{
                      fill: '#a78bfa',
                      stroke: '#18181b',
                      strokeWidth: 2,
                      r: 6,
                      className: 'chart-dot-active',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Play some sessions to see your activity chart." />
            )}
          </SpotlightCard>
        </ScrollReveal>

        {/* Jackpot tracker */}
        <ScrollReveal delay={160}>
          <SpotlightCard
            className="glass-card h-full rounded-2xl p-6"
            spotlightColor="rgba(245, 158, 11, 0.06)"
          >
            <div className="mb-6 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/10">
                <Trophy className="text-jackpot h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                Jackpot Tracker
              </h2>
            </div>
            <div className="space-y-4">
              <JackpotStatRow
                label="Jackpots Tracked"
                value={String(
                  (jackpotStats as Record<string, number>)?.total_jackpots_tracked ?? 0
                )}
              />
              <JackpotStatRow
                label="Total Value"
                value={`${formatSC((jackpotStats as Record<string, number>)?.total_jackpot_value ?? 0)} SC`}
                highlight
              />
              <div className="glow-line-gold" />
              <JackpotStatRow
                label="Hits (24h)"
                value={String((jackpotStats as Record<string, number>)?.hits_last_24h ?? 0)}
              />
              <JackpotStatRow
                label="Paid Out (30d)"
                value={`${formatSC((jackpotStats as Record<string, number>)?.total_paid_out_30d ?? 0)} SC`}
              />
            </div>
          </SpotlightCard>
        </ScrollReveal>
      </div>

      {/* ─── Platform table ──────────────────────────────────── */}
      {platformBreakdown.length > 0 && (
        <ScrollReveal delay={100}>
          <SpotlightCard
            className="glass-card overflow-hidden rounded-2xl"
            spotlightColor="rgba(139, 92, 246, 0.04)"
          >
            <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                Platform Performance
              </h2>
              <MagneticButton as="a" strength={0.25} radius={80}>
                <a
                  href="/platforms"
                  className="text-brand-400 hover:text-brand-300 gradient-underline group inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                >
                  View all
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </MagneticButton>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.03]">
                    <th className="px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Wagered
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Net
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      RTP
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                      Last Played
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(platformBreakdown as Record<string, unknown>[]).map((p) => {
                    const rtp = p['rtp'] as number | null
                    const net = p['net_profit'] as number
                    const rtpFmt = rtp ? formatRTP(rtp) : null
                    return (
                      <tr
                        key={p['platform_id'] as string}
                        className="table-row-hover border-b border-white/[0.02]"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            {p['logo_url'] ? (
                              <img
                                src={p['logo_url'] as string}
                                alt={`${p['name']} logo`}
                                className="h-7 w-7 rounded-lg ring-1 ring-white/[0.06]"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/50">
                                <Gamepad2 className="h-3.5 w-3.5 text-zinc-600" />
                              </div>
                            )}
                            <span className="font-semibold text-white">
                              {p['platform_name'] as string}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right font-medium tabular-nums text-zinc-300">
                          {p['session_count'] as number}
                        </td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-zinc-400">
                          {formatSC(p['total_wagered'] as number)} SC
                        </td>
                        <td
                          className={cn(
                            'px-6 py-3.5 text-right font-bold tabular-nums',
                            net >= 0 ? 'text-win' : 'text-loss'
                          )}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatSC(net)} SC
                        </td>
                        <td
                          className={cn(
                            'px-6 py-3.5 text-right font-medium tabular-nums',
                            rtpFmt?.className ?? 'text-zinc-600'
                          )}
                        >
                          {rtpFmt?.text ?? '\u2014'}
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-zinc-500">
                          {p['last_played_at'] ? timeAgo(p['last_played_at'] as string) : '\u2014'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SpotlightCard>
        </ScrollReveal>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const ACCENT_MAP = {
  emerald: { icon: 'bg-emerald-500/10 text-emerald-400', glow: 'hover:shadow-emerald-500/8' },
  red: { icon: 'bg-red-500/10 text-red-400', glow: 'hover:shadow-red-500/8' },
  brand: { icon: 'bg-brand-500/10 text-brand-400', glow: 'hover:shadow-brand-500/8' },
  violet: { icon: 'bg-violet-500/10 text-violet-400', glow: 'hover:shadow-violet-500/8' },
  blue: { icon: 'bg-blue-500/10 text-blue-400', glow: 'hover:shadow-blue-500/8' },
  yellow: { icon: 'bg-yellow-500/10 text-yellow-400', glow: 'hover:shadow-yellow-500/8' },
} as const

function StatCard({
  label,
  value,
  formatter,
  icon: Icon,
  valueClass = 'text-white',
  sub,
  accentColor = 'brand',
}: {
  label: string
  value: number
  formatter: (v: number) => string
  icon: React.ElementType
  valueClass?: string
  sub?: string
  accentColor?: keyof typeof ACCENT_MAP
}) {
  const accent = ACCENT_MAP[accentColor]

  return (
    <SpotlightCard
      className={cn('glass-card h-full space-y-3 rounded-2xl p-5', accent.glow)}
      spotlightColor={`rgba(139, 92, 246, 0.06)`}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl', accent.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
      </div>
      <p
        className={cn(
          'text-2xl font-extrabold tabular-nums tracking-tight lg:text-3xl',
          valueClass
        )}
      >
        {formatter(value)}
      </p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </SpotlightCard>
  )
}

function JackpotStatRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="group flex items-center justify-between">
      <span className="text-xs text-zinc-500 transition-colors group-hover:text-zinc-400">
        {label}
      </span>
      <span
        className={cn(
          'text-sm font-bold tabular-nums',
          highlight ? 'gradient-text-gold text-glow-gold' : 'text-white'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center">
      <div className="animate-fade-in text-center">
        <div className="empty-icon-wrapper mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/50">
          <TrendingUp className="h-5 w-5 text-zinc-600" />
        </div>
        <p className="max-w-xs text-balance text-sm text-zinc-600">{message}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-6 lg:p-8">
      {/* Hero skeleton */}
      <div className="glass-card-elevated space-y-4 rounded-3xl p-8">
        <div className="skeleton-text shimmer h-4 w-32" />
        <div className="skeleton-text shimmer h-10 w-64" />
        <div className="skeleton-text shimmer h-4 w-96" />
        <div className="mt-4 flex gap-3">
          <div className="shimmer h-14 w-40 rounded-xl bg-zinc-800/30" />
          <div className="shimmer h-14 w-32 rounded-xl bg-zinc-800/30" />
        </div>
      </div>
      {/* Marquee skeleton */}
      <div className="shimmer h-12 rounded-xl bg-zinc-800/20" />
      <div className="glass-card shimmer h-[80px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card shimmer h-32 rounded-2xl p-5" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card shimmer h-80 rounded-2xl lg:col-span-2" />
        <div className="glass-card shimmer h-80 rounded-2xl" />
      </div>
    </div>
  )
}
