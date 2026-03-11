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
  Wallet,
  Coins,
  BarChart3
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
    <div className="p-6 lg:p-10 space-y-10 max-w-[1600px] mx-auto pb-24">
      {/* ─── Hero header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden glass-card-elevated rounded-[2.5rem] p-8 lg:p-12 mb-8">
        {/* Dynamic Abstract Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-zinc-950/80 to-zinc-950" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4 animate-float-slow pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-6 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-brand-400 animate-pulse" />
              <span className="text-xs font-semibold text-brand-300 uppercase tracking-widest">{getGreeting()}</span>
            </div>

            <TextReveal
              as="h1"
              className="text-5xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-500 tracking-tight leading-[1.1] mb-6"
              stagger={40}
              delay={100}
            >
              Command Center
            </TextReveal>

            <p className="text-zinc-400 text-lg lg:text-xl font-medium leading-relaxed mb-8 max-w-xl">
              Your real-time sweepstakes intelligence hub. Track performance, optimize your edge, and dominate the platforms.
            </p>

            {/* Quick stats row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="group relative glass-card-static rounded-2xl px-5 py-4 overflow-hidden border border-white/5 hover:border-brand-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/0 to-brand-500/0 group-hover:from-brand-500/10 group-hover:to-transparent transition-all duration-500" />
                <div className="relative z-10">
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-[0.2em] mb-1">Lifetime Net P&L</p>
                  <p className={cn('text-3xl font-black tracking-tighter tabular-nums drop-shadow-sm', netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    <AnimatedValue value={netProfit} prefix={netProfit >= 0 ? '+' : ''} decimals={2} />
                    <span className="text-lg opacity-70 ml-1 font-bold">SC</span>
                  </p>
                </div>
              </div>

              <div className="group relative glass-card-static rounded-2xl px-5 py-4 overflow-hidden border border-white/5 hover:border-emerald-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/10 group-hover:to-transparent transition-all duration-500" />
                <div className="relative z-10">
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-[0.2em] mb-1">Total Wagered</p>
                  <p className="text-3xl font-black text-white tracking-tighter tabular-nums drop-shadow-sm">
                    <AnimatedValue value={totalBets} decimals={0} />
                    <span className="text-lg opacity-50 ml-1 font-bold">SC</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-auto mt-6 lg:mt-0">
            <ScrollReveal delay={300} distance={40}>
              <StreakWidget />
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* ─── Marquee stats ticker ──────────────────────────────── */}
      <ScrollReveal delay={100}>
        <MarqueeStrip speed={40} className="py-3 bg-zinc-950/50 backdrop-blur-xl border-y border-white/5 shadow-[0_0_40px_-10px_rgba(139,92,246,0.1)]">
          <MarqueeItem icon={<Activity className="w-4 h-4 text-brand-400" />} label="Total Sessions" value={String(totalSessions)} />
          <MarqueeItem icon={<Zap className="w-4 h-4 text-emerald-400" />} label="Avg RTP" value={rtpFormatted.text} />
          <MarqueeItem icon={<Gamepad2 className="w-4 h-4 text-violet-400" />} label="Active Platforms" value={String(activePlatforms)} />
          <MarqueeItem icon={<Clock className="w-4 h-4 text-blue-400" />} label="Time in Zone" value={`${hoursPlayed.toFixed(1)}h`} />
          <MarqueeItem icon={<Coins className="w-4 h-4 text-yellow-400" />} label="Total SC Wagered" value={totalBets.toLocaleString()} />
          <MarqueeItem
            icon={netProfit >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            label="Net Profit"
            value={`${netProfit >= 0 ? '+' : ''}${formatSC(netProfit)} SC`}
          />
        </MarqueeStrip>
      </ScrollReveal>

      {/* ─── Bento stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <ScrollReveal delay={0}>
          <StatCard
            label="Net P&L"
            value={netProfit}
            formatter={(v) => `${v >= 0 ? '+' : ''}${formatSC(v)} SC`}
            icon={netProfit >= 0 ? TrendingUp : TrendingDown}
            valueClass={netProfit >= 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200' : 'text-red-400'}
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
            sub="actively generating edge"
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
      <div className="grid lg:grid-cols-3 gap-6 pt-4">
        {/* 7-day chart */}
        <ScrollReveal delay={100} className="lg:col-span-2">
          <SpotlightCard className="glass-card rounded-[2rem] p-8 h-[440px] flex flex-col border border-white/5 relative overflow-hidden group shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]" spotlightColor="rgba(139, 92, 246, 0.1)">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-900/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between mb-8 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]">
                  <BarChart3 className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">7-Day Profit Curve</h2>
                  <p className="text-xs font-semibold text-zinc-500 tracking-wider">NET PERFORMANCE MATRIX</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest bg-brand-950/80 px-3 py-1.5 rounded-full border border-brand-500/20 backdrop-blur-md">Live Sync</span>
            </div>

            {recentActivity.length > 0 ? (
              <div className="flex-1 min-h-0 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentActivity as Record<string, number>[]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis
                      dataKey="play_date"
                      tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })}
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
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px -5px rgba(139,92,246,0.3)',
                        padding: '16px 20px',
                      }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 12, fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      itemStyle={{ color: '#fff', fontSize: 18, fontWeight: 900 }}
                      cursor={{ stroke: 'rgba(139, 92, 246, 0.4)', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#a78bfa"
                      strokeWidth={4}
                      fill="url(#netGradient)"
                      name="Net SC"
                      filter="url(#glow)"
                      activeDot={{ fill: '#ffffff', stroke: '#8b5cf6', strokeWidth: 4, r: 7, className: 'chart-dot-active drop-shadow-xl' }}
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
          <SpotlightCard className="glass-card rounded-[2rem] p-8 h-[440px] border border-white/5 relative overflow-hidden group shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)]" spotlightColor="rgba(245, 158, 11, 0.15)">
            <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/10 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-500/20 blur-[80px] rounded-full group-hover:bg-yellow-500/30 transition-colors duration-700 pointer-events-none" />

            <div className="relative flex items-center gap-3 mb-8 z-10">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-amber-600/20 border border-yellow-500/30 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)]">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Jackpot Radar</h2>
                <p className="text-xs font-semibold text-yellow-500/80 tracking-wider">GLOBAL INTEL</p>
              </div>
            </div>

            <div className="relative z-10 space-y-5 bg-black/20 rounded-2xl p-5 border border-white/5 shadow-inner">
              <JackpotStatRow
                label="Jackpots Tracked"
                value={String((jackpotStats as Record<string, number>)?.total_jackpots_tracked ?? 0)}
              />
              <JackpotStatRow
                label="Total Target Value"
                value={`${formatSC((jackpotStats as Record<string, number>)?.total_jackpot_value ?? 0)} SC`}
                highlight
              />
              <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent my-2" />
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
          <SpotlightCard className="glass-card rounded-[2rem] overflow-hidden border border-white/5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)] mt-4" spotlightColor="rgba(139, 92, 246, 0.08)">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center border border-zinc-700">
                  <Gamepad2 className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">Platform Performance</h2>
                  <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase mt-0.5">Where your edge lives</p>
                </div>
              </div>
              <MagneticButton as="a" strength={0.25} radius={80}>
                <a
                  href="/platforms"
                  className="mt-4 sm:mt-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all group"
                >
                  View full analysis
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </MagneticButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-black/20">
                    <th className="text-left px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Platform</th>
                    <th className="text-right px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Sessions</th>
                    <th className="text-right px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Wagered SC</th>
                    <th className="text-right px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Net P&L</th>
                    <th className="text-right px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Live RTP</th>
                    <th className="text-right px-8 py-4 text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em]">Last Engaged</th>
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
                        className="group hover:bg-white/[0.02] transition-colors duration-300"
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            {p['logo_url'] ? (
                              <img src={p['logo_url'] as string} alt={`${p['name']} logo`} className="w-10 h-10 rounded-xl ring-1 ring-white/10 shadow-lg group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                                <Gamepad2 className="w-5 h-5 text-zinc-500" />
                              </div>
                            )}
                            <span className="text-base font-bold text-white tracking-tight">{p['platform_name'] as string}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right text-zinc-400 font-semibold tabular-nums">{p['session_count'] as number}</td>
                        <td className="px-8 py-5 text-right text-zinc-300 font-medium tabular-nums">{formatSC(p['total_wagered'] as number)}</td>
                        <td className="px-8 py-5 text-right">
                          <div className={cn('inline-flex items-center justify-end px-3 py-1 rounded-full font-black text-sm tabular-nums',
                            net >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20')}>
                            {net >= 0 ? '+' : ''}{formatSC(net)}
                          </div>
                        </td>
                        <td className={cn('px-8 py-5 text-right font-black tabular-nums text-sm', rtpFmt?.className ?? 'text-zinc-600')}>
                          {rtpFmt ?
                            <span className="drop-shadow-sm">{rtpFmt.text}</span> :
                            '\u2014'
                          }
                        </td>
                        <td className="px-8 py-5 text-right text-zinc-500 font-medium text-xs">
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
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] hover:border-emerald-500/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]' },
  red:     { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)] hover:border-red-500/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]' },
  brand:   { bg: 'bg-brand-500/10', text: 'text-brand-400', border: 'border-brand-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] hover:border-brand-500/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]' },
  violet:  { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] hover:border-violet-400/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(139,92,246,0.4)]' },
  blue:    { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] hover:border-blue-500/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]' },
  yellow:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', glow: 'hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)] hover:border-yellow-500/40', iconGlow: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]' },
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
    <div className={cn('relative group h-full rounded-[1.5rem] bg-zinc-900/50 border backdrop-blur-xl transition-all duration-500 overflow-hidden', accent.border, accent.glow)}>
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none blur-3xl', accent.bg)} />
      <div className="relative p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className={cn('flex items-center justify-center w-10 h-10 rounded-xl border', accent.bg, accent.text, accent.border, accent.iconGlow)}>
            <Icon className="w-5 h-5" />
          </div>
          {/* Sparkline decorative element */}
          <div className="flex items-end gap-1 h-8 opacity-40 group-hover:opacity-100 transition-opacity duration-500">
             {[4, 7, 5, 8, 6, 9].map((h, i) => (
                <div key={i} className={cn("w-1.5 rounded-t-sm", accent.bg)} style={{ height: `${h * 10}%` }} />
             ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-[0.2em] mb-1.5">{label}</p>
          <p className={cn('text-3xl font-black tracking-tighter tabular-nums drop-shadow-md', valueClass)}>
            {formatter(value)}
          </p>
        </div>

        {sub && (
          <div className="pt-4 border-t border-white/5">
            <p className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">{sub}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function JackpotStatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between group py-1.5">
      <span className="text-sm font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
      <span className={cn(
        'text-base font-black tabular-nums tracking-tight',
        highlight ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'text-zinc-100'
      )}>{value}</span>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 mt-10">
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 shadow-inner flex items-center justify-center mx-auto mb-5 relative group cursor-pointer">
          <div className="absolute inset-0 bg-brand-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
          <Activity className="w-7 h-7 text-zinc-500 group-hover:text-brand-400 transition-colors" />
        </div>
        <p className="text-sm font-medium text-zinc-400 text-balance max-w-sm mx-auto leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-[1600px] mx-auto pb-24">
      {/* Hero skeleton */}
      <div className="glass-card-elevated rounded-[2.5rem] p-12 space-y-6">
        <div className="h-6 w-40 rounded-full bg-zinc-800/50 shimmer" />
        <div className="h-16 w-[400px] rounded-2xl bg-zinc-800/50 shimmer" />
        <div className="h-6 w-96 rounded-lg bg-zinc-800/50 shimmer" />
        <div className="flex gap-4 mt-8">
          <div className="h-24 w-48 bg-zinc-800/40 rounded-2xl border border-white/5 shimmer" />
          <div className="h-24 w-48 bg-zinc-800/40 rounded-2xl border border-white/5 shimmer" />
        </div>
      </div>
      {/* Marquee skeleton */}
      <div className="h-14 bg-zinc-900/50 rounded-xl shimmer border border-white/5" />
      {/* Bento Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[1.5rem] bg-zinc-900/50 border border-white/5 p-6 h-[200px] shimmer" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[2rem] bg-zinc-900/50 border border-white/5 h-[440px] shimmer" />
        <div className="rounded-[2rem] bg-zinc-900/50 border border-white/5 h-[440px] shimmer" />
      </div>
    </div>
  )
}
