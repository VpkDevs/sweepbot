import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Trophy,
  Banknote,
  Clock,
  Gamepad2,
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
import { StreakWidget } from '../components/ui/StreakWidget'

export function DashboardPage() {
  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['analytics', 'portfolio'],
    queryFn: () => api.analytics.portfolio(),
  })

  const { data: jackpotStats } = useQuery({
    queryKey: ['jackpots', 'stats'],
    queryFn: () => api.jackpots.stats(),
  })

  if (isLoading) {
    return <DashboardSkeleton />
  }

  const totals = (portfolio as Record<string, Record<string, number>>)?.totals ?? {}
  const recentActivity = (portfolio as Record<string, unknown[]>)?.recentActivity ?? []
  const platformBreakdown = (portfolio as Record<string, unknown[]>)?.platformBreakdown ?? []

  const rtp = totals['overall_rtp'] ?? 0
  const rtpFormatted = formatRTP(rtp)
  const netProfit = totals['net_profit'] ?? 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Command Center</h1>
        <p className="text-zinc-400 text-sm mt-1">Your complete sweepstakes portfolio at a glance.</p>
      </div>

      {/* Streak widget */}
      <StreakWidget />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Net P&L"
          value={`${netProfit >= 0 ? '+' : ''}${formatSC(netProfit)} SC`}
          icon={netProfit >= 0 ? TrendingUp : TrendingDown}
          valueClass={netProfit >= 0 ? 'text-win' : 'text-loss'}
          sub={`${totals['total_sessions'] ?? 0} total sessions`}
        />
        <StatCard
          label="Personal RTP"
          value={rtpFormatted.text}
          icon={Zap}
          valueClass={rtpFormatted.className}
          sub={`${(totals['total_bets'] ?? 0).toLocaleString()} total bets`}
        />
        <StatCard
          label="Active Platforms"
          value={String(totals['active_platforms'] ?? 0)}
          icon={Gamepad2}
          sub="platforms tracked"
        />
        <StatCard
          label="Hours Played"
          value={`${(totals['total_hours_played'] ?? 0).toFixed(1)}h`}
          icon={Clock}
          sub="all time"
        />
      </div>

      {/* Activity chart + platform table */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* 7-day activity chart */}
        <div className="lg:col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">7-Day Activity</h2>
          {recentActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={recentActivity as Record<string, number>[]}>
                <defs>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="play_date"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { weekday: 'short' })}
                />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#netGradient)"
                  name="Net SC"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Play some sessions to see your activity chart." />
          )}
        </div>

        {/* Jackpot stats mini-panel */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-jackpot" />
            <h2 className="text-sm font-semibold text-zinc-300">Jackpot Tracker</h2>
          </div>
          <div className="space-y-3">
            <JackpotStatRow
              label="Jackpots Tracked"
              value={String((jackpotStats as Record<string, number>)?.total_jackpots_tracked ?? 0)}
            />
            <JackpotStatRow
              label="Total Value"
              value={`${formatSC((jackpotStats as Record<string, number>)?.total_jackpot_value ?? 0)} SC`}
            />
            <JackpotStatRow
              label="Hits (24h)"
              value={String((jackpotStats as Record<string, number>)?.hits_last_24h ?? 0)}
            />
            <JackpotStatRow
              label="Paid Out (30d)"
              value={`${formatSC((jackpotStats as Record<string, number>)?.total_paid_out_30d ?? 0)} SC`}
            />
          </div>
        </div>
      </div>

      {/* Platform breakdown table */}
      {platformBreakdown.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300">Platform Performance</h2>
            <a href="/platforms" className="text-xs text-brand-400 hover:text-brand-300">
              View all →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium">Platform</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Sessions</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Wagered</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Net</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">RTP</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Last Played</th>
                </tr>
              </thead>
              <tbody>
                {(platformBreakdown as Record<string, unknown>[]).map((p) => {
                  const rtp = p['rtp'] as number | null
                  const net = p['net_profit'] as number
                  const rtpFmt = rtp ? formatRTP(rtp) : null
                  return (
                    <tr key={p['platform_id'] as string} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {p['logo_url'] && (
                            <img src={p['logo_url'] as string} alt="" className="w-5 h-5 rounded" />
                          )}
                          <span className="text-white font-medium">{p['platform_name'] as string}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-300 tabular-nums">{p['session_count'] as number}</td>
                      <td className="px-5 py-3 text-right text-zinc-300 tabular-nums">{formatSC(p['total_wagered'] as number)} SC</td>
                      <td className={cn('px-5 py-3 text-right tabular-nums font-medium', net >= 0 ? 'text-win' : 'text-loss')}>
                        {net >= 0 ? '+' : ''}{formatSC(net)} SC
                      </td>
                      <td className={cn('px-5 py-3 text-right tabular-nums', rtpFmt?.className ?? 'text-zinc-500')}>
                        {rtpFmt?.text ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                        {p['last_played_at'] ? timeAgo(p['last_played_at'] as string) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass = 'text-white',
  sub,
}: {
  label: string
  value: string
  icon: React.ElementType
  valueClass?: string
  sub?: string
}) {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1">
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', valueClass)}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function JackpotStatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 h-24" />
        ))}
      </div>
      <div className="h-64 bg-zinc-900 rounded-xl border border-zinc-800" />
    </div>
  )
}
