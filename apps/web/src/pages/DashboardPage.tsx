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
  Activity,
  Coins,
  BarChart3,
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
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { MarqueeStrip, MarqueeItem } from '../components/fx/MarqueeStrip'
import { AnimatedValue } from '../components/fx/AnimatedCounter'
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
    <div className="mx-auto max-w-[1600px] space-y-10 p-6 pb-24 lg:p-10">
      {/* ─── Hero header ─────────────────────────────────────── */}
      <div className="glass-card-elevated relative mb-8 overflow-hidden rounded-[2.5rem] p-8 lg:p-12">
        {/* Dynamic Abstract Backgrounds */}
        <div className="from-brand-900/40 absolute inset-0 bg-gradient-to-br via-zinc-950/80 to-zinc-950" />
        <div className="bg-brand-600/20 pointer-events-none absolute right-0 top-0 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/3 animate-pulse rounded-full blur-[120px]" />
        <div className="animate-float-slow pointer-events-none absolute bottom-0 left-0 h-[600px] w-[600px] -translate-x-1/4 translate-y-1/2 rounded-full bg-emerald-600/10 blur-[100px]" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row">
          <div className="max-w-2xl">
            <div className="bg-brand-500/10 border-brand-500/20 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="text-brand-400 h-4 w-4 animate-pulse" />
              <span className="text-brand-300 text-xs font-semibold uppercase tracking-widest">
                {getGreeting()}
              </span>
            </div>

            <TextReveal
              as="h1"
              className="mb-6 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-5xl font-extrabold leading-[1.1] tracking-tight text-transparent lg:text-7xl"
              stagger={40}
              delay={100}
            >
              Command Center
            </TextReveal>

            <p className="mb-8 max-w-xl text-lg font-medium leading-relaxed text-zinc-400 lg:text-xl">
              Your real-time sweepstakes intelligence hub. Track performance, understand your
              patterns, and stay informed across every platform.
            </p>

            {/* Quick stats row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="glass-card-static hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border border-white/5 px-5 py-4 transition-all duration-500">
                <div className="from-brand-500/0 to-brand-500/0 group-hover:from-brand-500/10 absolute inset-0 bg-gradient-to-br transition-all duration-500 group-hover:to-transparent" />
                <div className="relative z-10">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Lifetime Net P&L
                  </p>
                  <p
                    className={cn(
                      'text-3xl font-black tabular-nums tracking-tighter drop-shadow-sm',
                      netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    <AnimatedValue
                      value={netProfit}
                      prefix={netProfit >= 0 ? '+' : ''}
                      decimals={2}
                    />
                    <span className="ml-1 text-lg font-bold opacity-70">SC</span>
                  </p>
                </div>
              </div>

              <div className="glass-card-static group relative overflow-hidden rounded-2xl border border-white/5 px-5 py-4 transition-all duration-500 hover:border-emerald-500/30">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 transition-all duration-500 group-hover:from-emerald-500/10 group-hover:to-transparent" />
                <div className="relative z-10">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Total Wagered
                  </p>
                  <p className="text-3xl font-black tabular-nums tracking-tighter text-white drop-shadow-sm">
                    <AnimatedValue value={totalBets} decimals={0} />
                    <span className="ml-1 text-lg font-bold opacity-50">SC</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 w-full lg:mt-0 lg:w-auto">
            <ScrollReveal delay={300} distance={40}>
              <StreakWidget />
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* ─── Marquee stats ticker ──────────────────────────────── */}
      <ScrollReveal delay={100}>
        <MarqueeStrip
          speed={40}
          className="border-y border-white/5 bg-zinc-950/50 py-3 shadow-[0_0_40px_-10px_rgba(139,92,246,0.1)] backdrop-blur-xl"
        >
          <MarqueeItem
            icon={<Activity className="text-brand-400 h-4 w-4" />}
            label="Total Sessions"
            value={String(totalSessions)}
          />
          <MarqueeItem
            icon={<Zap className="h-4 w-4 text-emerald-400" />}
            label="Avg RTP"
            value={rtpFormatted.text}
          />
          <MarqueeItem
            icon={<Gamepad2 className="h-4 w-4 text-violet-400" />}
            label="Active Platforms"
            value={String(activePlatforms)}
          />
          <MarqueeItem
            icon={<Clock className="h-4 w-4 text-blue-400" />}
            label="Time in Zone"
            value={`${hoursPlayed.toFixed(1)}h`}
          />
          <MarqueeItem
            icon={<Coins className="h-4 w-4 text-yellow-400" />}
            label="Total SC Wagered"
            value={totalBets.toLocaleString()}
          />
          <MarqueeItem
            icon={
              netProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )
            }
            label="Net P&L"
            value={`${netProfit >= 0 ? '+' : ''}${formatSC(netProfit)} SC`}
          />
        </MarqueeStrip>
      </ScrollReveal>

      {/* ─── Bento stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <ScrollReveal delay={0}>
          <StatCard
            label="Net P&L"
            value={netProfit}
            formatter={(v) => `${v >= 0 ? '+' : ''}${formatSC(v)} SC`}
            icon={netProfit >= 0 ? TrendingUp : TrendingDown}
            valueClass={
              netProfit >= 0
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200'
                : 'text-red-400'
            }
            sub={`${totalSessions} sessions played`}
            accentColor={netProfit >= 0 ? 'emerald' : 'red'}
          />
        </ScrollReveal>
        <ScrollReveal delay={75}>
          <StatCard
            label="Personal RTP"
            value={rtp}
            formatter={(v) => formatRTP(v).text}
            icon={Zap}
            valueClass="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-fuchsia-300"
            sub={`${totalBets.toLocaleString()} total bets`}
            accentColor="brand"
          />
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <StatCard
            label="Platforms"
            value={activePlatforms}
            formatter={(v) => String(Math.round(v))}
            icon={Gamepad2}
            valueClass="text-white"
            sub="actively being tracked"
            accentColor="violet"
          />
        </ScrollReveal>
        <ScrollReveal delay={225}>
          <StatCard
            label="Hours Played"
            value={hoursPlayed}
            formatter={(v) => `${v.toFixed(1)}h`}
            icon={Clock}
            valueClass="text-zinc-200"
            sub="time invested"
            accentColor="blue"
          />
        </ScrollReveal>
      </div>

      {/* ─── Activity chart + Jackpot tracker ─────────────────── */}
      <div className="grid gap-6 pt-4 lg:grid-cols-3">
        {/* 7-day chart */}
        <ScrollReveal delay={100} className="lg:col-span-2">
          <SpotlightCard
            className="glass-card group relative flex h-[440px] flex-col overflow-hidden rounded-[2rem] border border-white/5 p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]"
            spotlightColor="rgba(139, 92, 246, 0.1)"
          >
            <div className="from-brand-900/5 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent" />
            <div className="relative z-10 mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-brand-500/10 border-brand-500/20 flex h-10 w-10 items-center justify-center rounded-xl border shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
                  <BarChart3 className="text-brand-400 h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white">
                    7-Day SC Balance Chart
                  </h2>
                  <p className="text-xs font-semibold tracking-wider text-zinc-500">
                    NET ACTIVITY SUMMARY
                  </p>
                </div>
              </div>
              <span className="text-brand-300 bg-brand-950/80 border-brand-500/20 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                Live Sync
              </span>
            </div>

            {recentActivity.length > 0 ? (
              <div className="relative z-10 min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={recentActivity as Record<string, number>[]}
                    margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                        <stop offset="50%" stopColor="#a78bfa" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="rgba(255, 255, 255, 0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="play_date"
                      tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }}
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString('en', { weekday: 'short' })
                      }
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}`}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(9, 9, 11, 0.85)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '16px',
                        backdropFilter: 'blur(20px)',
                        boxShadow:
                          '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px -5px rgba(139,92,246,0.3)',
                        padding: '16px 20px',
                      }}
                      labelStyle={{
                        color: '#a1a1aa',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                      itemStyle={{ color: '#fff', fontSize: 18, fontWeight: 900 }}
                      cursor={{
                        stroke: 'rgba(139, 92, 246, 0.4)',
                        strokeWidth: 2,
                        strokeDasharray: '4 4',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#a78bfa"
                      strokeWidth={4}
                      fill="url(#netGradient)"
                      name="Net SC"
                      filter="url(#glow)"
                      activeDot={{
                        fill: '#ffffff',
                        stroke: '#8b5cf6',
                        strokeWidth: 4,
                        r: 7,
                        className: 'chart-dot-active drop-shadow-xl',
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart message="Connect a platform and play your first session to generate the performance matrix." />
            )}
          </SpotlightCard>
        </ScrollReveal>

        {/* Jackpot tracker */}
        <ScrollReveal delay={200}>
          <SpotlightCard
            className="glass-card group relative h-[440px] overflow-hidden rounded-[2rem] border border-white/5 p-8 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]"
            spotlightColor="rgba(245, 158, 11, 0.15)"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-yellow-900/10 to-transparent" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-yellow-500/20 blur-[80px] transition-colors duration-700 group-hover:bg-yellow-500/30" />

            <div className="relative z-10 mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-400/20 to-amber-600/20 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)]">
                <Trophy className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white">Jackpot Radar</h2>
                <p className="text-xs font-semibold tracking-wider text-yellow-500/80">
                  GLOBAL INTEL
                </p>
              </div>
            </div>

            <div className="relative z-10 space-y-5 rounded-2xl border border-white/5 bg-black/20 p-5 shadow-inner">
              <JackpotStatRow
                label="Jackpots Tracked"
                value={String(
                  (jackpotStats as Record<string, number>)?.total_jackpots_tracked ?? 0
                )}
              />
              <JackpotStatRow
                label="Total Target Value"
                value={`${formatSC((jackpotStats as Record<string, number>)?.total_jackpot_value ?? 0)} SC`}
                highlight
              />
              <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
              <JackpotStatRow
                label="Community Hits (24h)"
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
        <ScrollReveal delay={150}>
          <SpotlightCard
            className="glass-card mt-4 overflow-hidden rounded-[2rem] border border-white/5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)]"
            spotlightColor="rgba(139, 92, 246, 0.08)"
          >
            <div className="flex flex-col items-start justify-between border-b border-white/5 bg-white/[0.01] px-8 py-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80">
                  <Gamepad2 className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white">
                    Platform Performance
                  </h2>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                    Your activity by platform
                  </p>
                </div>
              </div>
              <MagneticButton as="a" strength={0.25} radius={80}>
                <a
                  href="/platforms"
                  className="group mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/10 sm:mt-0"
                >
                  View full analysis
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </MagneticButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-black/20">
                    <th className="px-8 py-4 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Platform
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Sessions
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Wagered SC
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Net P&L
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Live RTP
                    </th>
                    <th className="px-8 py-4 text-right text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Last Engaged
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {(platformBreakdown as Record<string, unknown>[]).map((p) => {
                    const rtp = p['rtp'] as number | null
                    const net = p['net_profit'] as number
                    const rtpFmt = rtp ? formatRTP(rtp) : null
                    return (
                      <tr
                        key={p['platform_id'] as string}
                        className="group transition-colors duration-300 hover:bg-white/[0.02]"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            {p['logo_url'] ? (
                              <img
                                src={p['logo_url'] as string}
                                alt={`${p['name']} logo`}
                                className="h-10 w-10 rounded-xl shadow-lg ring-1 ring-white/10 transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-lg transition-transform group-hover:scale-105">
                                <Gamepad2 className="h-5 w-5 text-zinc-500" />
                              </div>
                            )}
                            <span className="text-base font-bold tracking-tight text-white">
                              {p['platform_name'] as string}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right font-semibold tabular-nums text-zinc-400">
                          {p['session_count'] as number}
                        </td>
                        <td className="px-8 py-5 text-right font-medium tabular-nums text-zinc-300">
                          {formatSC(p['total_wagered'] as number)}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div
                            className={cn(
                              'inline-flex items-center justify-end rounded-full px-3 py-1 text-sm font-black tabular-nums',
                              net >= 0
                                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : 'border border-red-500/20 bg-red-500/10 text-red-400'
                            )}
                          >
                            {net >= 0 ? '+' : ''}
                            {formatSC(net)}
                          </div>
                        </td>
                        <td
                          className={cn(
                            'px-8 py-5 text-right text-sm font-black tabular-nums',
                            rtpFmt?.className ?? 'text-zinc-600'
                          )}
                        >
                          {rtpFmt ? (
                            <span className="drop-shadow-sm">{rtpFmt.text}</span>
                          ) : (
                            '\u2014'
                          )}
                        </td>
                        <td className="px-8 py-5 text-right text-xs font-medium text-zinc-500">
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
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] hover:border-emerald-500/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]',
  },
  red: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)] hover:border-red-500/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]',
  },
  brand: {
    bg: 'bg-brand-500/10',
    text: 'text-brand-400',
    border: 'border-brand-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] hover:border-brand-500/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] hover:border-violet-400/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] hover:border-blue-500/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    glow: 'hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)] hover:border-yellow-500/40',
    iconGlow: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]',
  },
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
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-[1.5rem] border bg-zinc-900/50 backdrop-blur-xl transition-all duration-500',
        accent.border,
        accent.glow
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-20',
          accent.bg
        )}
      />
      <div className="relative space-y-4 p-6">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border',
              accent.bg,
              accent.text,
              accent.border,
              accent.iconGlow
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          {/* Sparkline decorative element */}
          <div className="flex h-8 items-end gap-1 opacity-40 transition-opacity duration-500 group-hover:opacity-100">
            {[4, 7, 5, 8, 6, 9].map((h, i) => (
              <div
                key={i}
                className={cn('w-1.5 rounded-t-sm', accent.bg)}
                style={{ height: `${h * 10}%` }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            {label}
          </p>
          <p
            className={cn(
              'text-3xl font-black tabular-nums tracking-tighter drop-shadow-md',
              valueClass
            )}
          >
            {formatter(value)}
          </p>
        </div>

        {sub && (
          <div className="border-t border-white/5 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {sub}
            </p>
          </div>
        )}
      </div>
    </div>
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
    <div className="group flex items-center justify-between py-1.5">
      <span className="text-sm font-semibold text-zinc-400 transition-colors group-hover:text-zinc-200">
        {label}
      </span>
      <span
        className={cn(
          'text-base font-black tabular-nums tracking-tight',
          highlight
            ? 'bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]'
            : 'text-zinc-100'
        )}
      >
        {value}
      </span>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="mt-10 flex h-full flex-col items-center justify-center p-6">
      <div className="animate-fade-in text-center">
        <div className="group relative mx-auto mb-5 flex h-16 w-16 cursor-pointer items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-800/80 shadow-inner">
          <div className="bg-brand-500/20 absolute inset-0 rounded-full opacity-0 blur-xl transition-opacity group-hover:opacity-100"></div>
          <Activity className="group-hover:text-brand-400 h-7 w-7 text-zinc-500 transition-colors" />
        </div>
        <p className="mx-auto max-w-sm text-balance text-sm font-medium leading-relaxed text-zinc-400">
          {message}
        </p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-10 p-6 pb-24 lg:p-10">
      {/* Hero skeleton */}
      <div className="glass-card-elevated space-y-6 rounded-[2.5rem] p-12">
        <div className="shimmer h-6 w-40 rounded-full bg-zinc-800/50" />
        <div className="shimmer h-16 w-[400px] rounded-2xl bg-zinc-800/50" />
        <div className="shimmer h-6 w-96 rounded-lg bg-zinc-800/50" />
        <div className="mt-8 flex gap-4">
          <div className="shimmer h-24 w-48 rounded-2xl border border-white/5 bg-zinc-800/40" />
          <div className="shimmer h-24 w-48 rounded-2xl border border-white/5 bg-zinc-800/40" />
        </div>
      </div>
      {/* Marquee skeleton */}
      <div className="shimmer h-14 rounded-xl border border-white/5 bg-zinc-900/50" />
      {/* Bento Skeleton */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="shimmer h-[200px] rounded-[1.5rem] border border-white/5 bg-zinc-900/50 p-6"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="shimmer h-[440px] rounded-[2rem] border border-white/5 bg-zinc-900/50 lg:col-span-2" />
        <div className="shimmer h-[440px] rounded-[2rem] border border-white/5 bg-zinc-900/50" />
      </div>
    </div>
  )
}
