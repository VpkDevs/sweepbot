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
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* ─── Hero header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden glass-card-elevated rounded-3xl p-6 lg:p-8 aurora-bg liquid-glass">
        <div className="relative z-10">
          <p className="text-zinc-500 text-sm mb-1">{getGreeting()}</p>
          <TextReveal
            as="h1"
            className="heading-display text-3xl lg:text-4xl text-white text-shimmer"
            stagger={60}
            delay={100}
          >
            Command Center
          </TextReveal>
          <ScrollReveal delay={200} distance={20}>
            <p className="text-zinc-400 text-sm mt-2 max-w-lg text-pretty">
              Your complete sweepstakes portfolio. Track performance, manage flows, and hit new records.
            </p>
          </ScrollReveal>

          {/* Quick stats bar */}
          <ScrollReveal delay={300} distance={20}>
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="flex items-center gap-2 glass-card-static rounded-xl px-3 py-2 holo-surface">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-brand-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Lifetime P&L</p>
                  <p className={cn('text-sm font-bold tabular-nums', netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    <AnimatedValue value={netProfit} prefix={netProfit >= 0 ? '+' : ''} decimals={2} />
                    <span className="text-zinc-500 text-xs ml-0.5">SC</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 glass-card-static rounded-xl px-3 py-2 holo-surface">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center">
                  <Target className="w-3 h-3 text-brand-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sessions</p>
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
          <MarqueeItem icon={<Activity className="w-3.5 h-3.5" />} label="Total Sessions" value={String(totalSessions)} />
          <MarqueeItem icon={<Zap className="w-3.5 h-3.5" />} label="Personal RTP" value={rtpFormatted.text} />
          <MarqueeItem icon={<Gamepad2 className="w-3.5 h-3.5" />} label="Platforms" value={String(activePlatforms)} />
          <MarqueeItem icon={<Clock className="w-3.5 h-3.5" />} label="Hours Played" value={`${hoursPlayed.toFixed(1)}h`} />
          <MarqueeItem icon={<Trophy className="w-3.5 h-3.5" />} label="Total Bets" value={totalBets.toLocaleString()} />
          <MarqueeItem
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Net P&L"
            value={`${netProfit >= 0 ? '+' : ''}${formatSC(netProfit)} SC`}
          />
        </MarqueeStrip>
      </ScrollReveal>

      {/* ─── Streak widget ───────────────────────────────────── */}
      <ScrollReveal delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StreakWidget />
          <DailyStreakWidget />
        </div>
      </ScrollReveal>

      {/* ─── Bento stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 7-day chart */}
        <ScrollReveal delay={100} className="lg:col-span-2">
          <SpotlightCard className="glass-card rounded-2xl p-6 h-full" spotlightColor="rgba(139, 92, 246, 0.06)">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">7-Day Activity</h2>
              <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-2 py-1 rounded-lg">Last 7 days</span>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(63, 63, 70, 0.2)" vertical={false} />
                  <XAxis
                    dataKey="play_date"
                    tick={{ fill: '#52525b', fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })}
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
                    activeDot={{ fill: '#a78bfa', stroke: '#18181b', strokeWidth: 2, r: 6, className: 'chart-dot-active' }}
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
          <SpotlightCard className="glass-card rounded-2xl p-6 h-full" spotlightColor="rgba(245, 158, 11, 0.06)">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/10">
                <Trophy className="w-4 h-4 text-jackpot" />
              </div>
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Jackpot Tracker</h2>
            </div>
            <div className="space-y-4">
              <JackpotStatRow
                label="Jackpots Tracked"
                value={String((jackpotStats as Record<string, number>)?.total_jackpots_tracked ?? 0)}
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
          <SpotlightCard className="glass-card rounded-2xl overflow-hidden" spotlightColor="rgba(139, 92, 246, 0.04)">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">Platform Performance</h2>
              <MagneticButton as="a" strength={0.25} radius={80}>
                <a
                  href="/platforms"
                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors group gradient-underline"
                >
                  View all
                  <ArrowUpRight className="w-3 h-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </MagneticButton>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.03]">
                    <th className="text-left px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">Platform</th>
                    <th className="text-right px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">Sessions</th>
                    <th className="text-right px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">Wagered</th>
                    <th className="text-right px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">Net</th>
                    <th className="text-right px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">RTP</th>
                    <th className="text-right px-6 py-3 text-zinc-500 font-semibold text-[10px] uppercase tracking-[0.15em]">Last Played</th>
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
                        className="border-b border-white/[0.02] table-row-hover"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            {p['logo_url'] ? (
                              <img src={p['logo_url'] as string} alt={`${p['name']} logo`} className="w-7 h-7 rounded-lg ring-1 ring-white/[0.06]" />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-zinc-800/50 flex items-center justify-center">
                                <Gamepad2 className="w-3.5 h-3.5 text-zinc-600" />
                              </div>
                            )}
                            <span className="text-white font-semibold">{p['platform_name'] as string}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right text-zinc-300 tabular-nums font-medium">{p['session_count'] as number}</td>
                        <td className="px-6 py-3.5 text-right text-zinc-400 tabular-nums">{formatSC(p['total_wagered'] as number)} SC</td>
                        <td className={cn('px-6 py-3.5 text-right tabular-nums font-bold', net >= 0 ? 'text-win' : 'text-loss')}>
                          {net >= 0 ? '+' : ''}{formatSC(net)} SC
                        </td>
                        <td className={cn('px-6 py-3.5 text-right tabular-nums font-medium', rtpFmt?.className ?? 'text-zinc-600')}>
                          {rtpFmt?.text ?? '\u2014'}
                        </td>
                        <td className="px-6 py-3.5 text-right text-zinc-500 text-xs">
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
  red:     { icon: 'bg-red-500/10 text-red-400', glow: 'hover:shadow-red-500/8' },
  brand:   { icon: 'bg-brand-500/10 text-brand-400', glow: 'hover:shadow-brand-500/8' },
  violet:  { icon: 'bg-violet-500/10 text-violet-400', glow: 'hover:shadow-violet-500/8' },
  blue:    { icon: 'bg-blue-500/10 text-blue-400', glow: 'hover:shadow-blue-500/8' },
  yellow:  { icon: 'bg-yellow-500/10 text-yellow-400', glow: 'hover:shadow-yellow-500/8' },
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
      className={cn('glass-card rounded-2xl p-5 space-y-3 h-full', accent.glow)}
      spotlightColor={`rgba(139, 92, 246, 0.06)`}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-xl', accent.icon)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className={cn('text-2xl lg:text-3xl font-extrabold tabular-nums tracking-tight', valueClass)}>
        {formatter(value)}
      </p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </SpotlightCard>
  )
}

function JackpotStatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{label}</span>
      <span className={cn(
        'text-sm font-bold tabular-nums',
        highlight ? 'gradient-text-gold text-glow-gold' : 'text-white'
      )}>{value}</span>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="empty-icon-wrapper w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-5 h-5 text-zinc-600" />
        </div>
        <p className="text-sm text-zinc-600 text-balance max-w-xs">{message}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Hero skeleton */}
      <div className="glass-card-elevated rounded-3xl p-8 space-y-4">
        <div className="h-4 w-32 skeleton-text shimmer" />
        <div className="h-10 w-64 skeleton-text shimmer" />
        <div className="h-4 w-96 skeleton-text shimmer" />
        <div className="flex gap-3 mt-4">
          <div className="h-14 w-40 bg-zinc-800/30 rounded-xl shimmer" />
          <div className="h-14 w-32 bg-zinc-800/30 rounded-xl shimmer" />
        </div>
      </div>
      {/* Marquee skeleton */}
      <div className="h-12 bg-zinc-800/20 rounded-xl shimmer" />
      <div className="h-[80px] glass-card rounded-2xl shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 h-32 shimmer" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl h-80 shimmer" />
        <div className="glass-card rounded-2xl h-80 shimmer" />
      </div>
    </div>
  )
}
