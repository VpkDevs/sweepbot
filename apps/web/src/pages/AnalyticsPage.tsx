import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Clock,
  Star,
  Flame,
  Download,
  Lightbulb,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatRTP, formatSC, confidenceColor, CHART_TOOLTIP_STYLE } from '../lib/utils'

type Granularity = 'day' | 'week' | 'month'

export function AnalyticsPage() {
  const [granularity, setGranularity] = useState<Granularity>('week')

  const { data: rtpData } = useQuery({
    queryKey: ['analytics', 'rtp', granularity],
    queryFn: () => api.analytics.rtp({ granularity }),
  })

  const { data: temporalData } = useQuery({
    queryKey: ['analytics', 'temporal'],
    queryFn: () => api.analytics.temporal(),
  })

  const { data: bonusData } = useQuery({
    queryKey: ['analytics', 'bonus'],
    queryFn: () => api.analytics.bonus(),
  })

  // New endpoints from gap analysis
  const { data: streakData } = useQuery({
    queryKey: ['analytics', 'streaks'],
    queryFn: () => api.analytics.streaks(),
  })

  const { data: insightsData } = useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => api.analytics.insights(),
  })

  const rtp = rtpData as Record<string, unknown> | undefined
  const temporal = temporalData as Record<string, unknown> | undefined
  const bonus = bonusData as Record<string, unknown> | undefined

  const streak = streakData as Record<string, unknown> | undefined
  const insights = insightsData as Record<string, unknown> | undefined

  const currentStreak =
    (streak?.['daily_streak'] as number) ?? (streak?.['current_streak'] as number) ?? 0
  const longestStreak = (streak?.['longest_streak'] as number) ?? 0
  const insightItems = (insights?.['insights'] as Record<string, unknown>[]) ?? []

  const overallRTP = (rtp?.['overall_rtp'] as number) ?? 0
  const overallFmt = formatRTP(overallRTP)
  const totalBets = (rtp?.['total_bets'] as number) ?? 0
  const confidence = (rtp?.['confidence_level'] as number) ?? 0

  const timeSeries = (rtp?.['time_series'] as Record<string, unknown>[]) ?? []
  const byGame = (rtp?.['by_game'] as Record<string, unknown>[]) ?? []
  const byPlatform = (rtp?.['by_platform'] as Record<string, unknown>[]) ?? []

  const byHour = (temporal?.['by_hour'] as Record<string, unknown>[]) ?? []
  const byDow = (temporal?.['by_dow'] as Record<string, unknown>[]) ?? []

  const bonusTriggerRate = (bonus?.['trigger_rate'] as number) ?? 0
  const _bonusAvgPayout = (bonus?.['avg_payout'] as number) ?? 0
  const bonusRTPContribution = (bonus?.['rtp_contribution_percent'] as number) ?? 0
  const bonusByGame = (bonus?.['by_game'] as Record<string, unknown>[]) ?? []

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const byDowFormatted = byDow.map((d) => ({
    ...d,
    day: DOW_LABELS[d['dow'] as number] ?? d['dow'],
  }))

  function handleExport() {
    const today = new Date()
    const startOfYear = `${today.getFullYear()}-01-01`
    const todayStr = today.toISOString().slice(0, 10)
    // api.analytics.export returns the URL string directly
    const url = `${import.meta.env.VITE_API_URL ?? '/api/v1'}${api.analytics.export({ start_date: startOfYear, end_date: todayStr })}`
    window.open(url, '_blank')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Deep intelligence on your personal RTP, bonus performance, and temporal patterns.
          </p>
        </div>
        <button
          id="analytics-export-btn"
          onClick={handleExport}
          className="hover:border-brand-500 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-all hover:text-white"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Streak cards row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Current Streak</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-amber-400">{currentStreak}d</p>
          <p className="text-xs text-zinc-500">consecutive active days</p>
        </div>
        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Longest Streak</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-zinc-300">{longestStreak}d</p>
          <p className="text-xs text-zinc-500">personal best</p>
        </div>
      </div>

      {/* RTP Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Overall RTP</span>
          </div>
          <p className={cn('text-3xl font-black tabular-nums', overallFmt.className)}>
            {overallFmt.text}
          </p>
          <p className="text-xs text-zinc-500">{totalBets.toLocaleString()} total bets</p>
        </div>

        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <BarChart2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Confidence</span>
          </div>
          <p
            className={cn(
              'text-3xl font-black tabular-nums',
              confidenceColor(confidence < 33 ? 'low' : confidence < 66 ? 'medium' : 'high')
            )}
          >
            {confidence < 33 ? 'Low' : confidence < 66 ? 'Med' : 'High'}
          </p>
          <p className="text-xs text-zinc-500">{totalBets.toLocaleString()} bets needed for high</p>
        </div>

        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Star className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Bonus Trigger Rate</span>
          </div>
          <p className="text-brand-400 text-3xl font-black tabular-nums">
            1/{bonusTriggerRate > 0 ? Math.round(100 / bonusTriggerRate) : '—'}
          </p>
          <p className="text-xs text-zinc-500">spins per bonus trigger</p>
        </div>

        <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Bonus Contribution</span>
          </div>
          <p className="text-brand-400 text-3xl font-black tabular-nums">
            {bonusRTPContribution.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-500">of total RTP from bonuses</p>
        </div>
      </div>

      {/* RTP time series */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">RTP Over Time</h2>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
                  granularity === g
                    ? 'bg-brand-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        {timeSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timeSeries as Record<string, number>[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="period" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: number) => [`${v.toFixed(2)}%`, 'RTP']}
              />
              <Line
                type="monotone"
                dataKey="rtp"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="RTP"
              />
              <Line
                type="monotone"
                dataKey="theoretical_rtp"
                stroke="#3f3f46"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 4"
                name="Theoretical"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Play more sessions to see your RTP trend." />
        )}
      </div>

      {/* Temporal heatmaps */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">RTP by Hour of Day</h2>
          {byHour.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byHour as Record<string, number>[]}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, 'RTP']}
                />
                <Bar dataKey="avg_rtp" name="Avg RTP">
                  {byHour.map((entry) => (
                    <Cell
                      key={`hour-${entry['hour'] as number}`}
                      fill={
                        (entry['avg_rtp'] as number) >= 96
                          ? '#22c55e'
                          : (entry['avg_rtp'] as number) >= 90
                            ? '#eab308'
                            : '#ef4444'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Need more sessions to show hourly patterns." />
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">RTP by Day of Week</h2>
          {byDowFormatted.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byDowFormatted as Record<string, unknown>[]}>
                <XAxis dataKey="day" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, 'RTP']}
                />
                <Bar dataKey="avg_rtp" name="Avg RTP" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Need more sessions to show daily patterns." />
          )}
        </div>
      </div>

      {/* By game / by platform */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h2 className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-300">
            Best Games by Personal RTP
          </h2>
          {byGame.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {byGame.slice(0, 8).map((g) => {
                const rtp = g['personal_rtp'] as number
                const fmt = formatRTP(rtp)
                return (
                  <div
                    key={g['game_id'] as string}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">{g['game_name'] as string}</p>
                      <p className="text-xs text-zinc-600">{g['platform_name'] as string}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold tabular-nums', fmt.className)}>
                        {fmt.text}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {(g['bet_count'] as number).toLocaleString()} bets
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="No game-level data yet." />
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h2 className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-300">
            Platform Performance
          </h2>
          {byPlatform.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {byPlatform.map((p) => {
                const rtp = p['personal_rtp'] as number
                const net = p['net_profit'] as number
                const fmt = formatRTP(rtp)
                return (
                  <div
                    key={p['platform_id'] as string}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <p className="text-sm text-white">{p['platform_name'] as string}</p>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-zinc-500">Net P&L</p>
                        <p
                          className={cn(
                            'text-sm font-medium tabular-nums',
                            net >= 0 ? 'text-win' : 'text-loss'
                          )}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatSC(net)} SC
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">RTP</p>
                        <p className={cn('text-sm tabular-nums', fmt.className)}>{fmt.text}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="No platform analytics yet." />
          )}
        </div>
      </div>

      {/* Bonus analytics */}
      {bonusByGame.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h2 className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-300">
            Bonus Analytics by Game
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 text-left font-medium text-zinc-500">Game</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">Trigger Rate</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">Avg Payout</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">
                    RTP Contribution
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">vs Theoretical</th>
                </tr>
              </thead>
              <tbody>
                {bonusByGame.map((g) => {
                  const diff =
                    (g['actual_trigger_rate'] as number) - (g['theoretical_trigger_rate'] as number)
                  return (
                    <tr
                      key={g['game_id'] as string}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-5 py-3 text-white">{g['game_name'] as string}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-300">
                        1/{Math.round(100 / (g['actual_trigger_rate'] as number))}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-300">
                        {formatSC(g['avg_bonus_payout'] as number)} SC
                      </td>
                      <td className="text-brand-300 px-5 py-3 text-right tabular-nums">
                        {(g['rtp_contribution_pct'] as number).toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right tabular-nums',
                          diff > 0 ? 'text-win' : diff < 0 ? 'text-loss' : 'text-zinc-400'
                        )}
                      >
                        {diff >= 0 ? '+' : ''}
                        {diff.toFixed(2)}%
                        {diff > 0 ? (
                          <TrendingUp className="ml-1 inline h-3 w-3" />
                        ) : (
                          <TrendingDown className="ml-1 inline h-3 w-3" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Analytics Insights */}
      {insightItems.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <h2 className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-300">
            <Lightbulb className="text-brand-400 h-4 w-4" />
            Personalized Insights
          </h2>
          <div className="divide-y divide-zinc-800">
            {insightItems.map((insight, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="bg-brand-500 mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" />
                  <div>
                    {Boolean(insight['title']) && (
                      <p className="mb-0.5 text-sm font-medium text-white">
                        {insight['title'] as string}
                      </p>
                    )}
                    <p className="text-sm text-zinc-400">
                      {(insight['message'] ?? insight['text'] ?? insight['description']) as string}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[160px] items-center justify-center">
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  )
}
