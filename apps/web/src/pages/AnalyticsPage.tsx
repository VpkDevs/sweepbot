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
import { Zap, TrendingUp, TrendingDown, BarChart2, Clock, Star } from 'lucide-react'
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

  const rtp = rtpData as Record<string, unknown> | undefined
  const temporal = temporalData as Record<string, unknown> | undefined
  const bonus = bonusData as Record<string, unknown> | undefined

  const overallRTP = rtp?.['overall_rtp'] as number ?? 0
  const overallFmt = formatRTP(overallRTP)
  const totalBets = rtp?.['total_bets'] as number ?? 0
  const confidence = rtp?.['confidence_level'] as number ?? 0

  const timeSeries = (rtp?.['time_series'] as Record<string, unknown>[]) ?? []
  const byGame = (rtp?.['by_game'] as Record<string, unknown>[]) ?? []
  const byPlatform = (rtp?.['by_platform'] as Record<string, unknown>[]) ?? []

  const byHour = (temporal?.['by_hour'] as Record<string, unknown>[]) ?? []
  const byDow = (temporal?.['by_dow'] as Record<string, unknown>[]) ?? []

  const bonusTriggerRate = bonus?.['trigger_rate'] as number ?? 0
  const _bonusAvgPayout = bonus?.['avg_payout'] as number ?? 0
  const bonusRTPContribution = bonus?.['rtp_contribution_percent'] as number ?? 0
  const bonusByGame = (bonus?.['by_game'] as Record<string, unknown>[]) ?? []

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const byDowFormatted = byDow.map((d) => ({
    ...d,
    day: DOW_LABELS[d['dow'] as number] ?? d['dow'],
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Deep intelligence on your personal RTP, bonus performance, and temporal patterns.
        </p>
      </div>

      {/* RTP Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Overall RTP</span>
          </div>
          <p className={cn('text-3xl font-black tabular-nums', overallFmt.className)}>
            {overallFmt.text}
          </p>
          <p className="text-xs text-zinc-500">{totalBets.toLocaleString()} total bets</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <BarChart2 className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Confidence</span>
          </div>
          <p className={cn('text-3xl font-black tabular-nums', confidenceColor(confidence < 33 ? 'low' : confidence < 66 ? 'medium' : 'high'))}>
            {confidence < 33 ? 'Low' : confidence < 66 ? 'Med' : 'High'}
          </p>
          <p className="text-xs text-zinc-500">{totalBets.toLocaleString()} bets needed for high</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <Star className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Bonus Trigger Rate</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-brand-400">
            1/{bonusTriggerRate > 0 ? Math.round(100 / bonusTriggerRate) : '—'}
          </p>
          <p className="text-xs text-zinc-500">spins per bonus trigger</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Bonus Contribution</span>
          </div>
          <p className="text-3xl font-black tabular-nums text-brand-400">
            {bonusRTPContribution.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-500">of total RTP from bonuses</p>
        </div>
      </div>

      {/* RTP time series */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-300">RTP Over Time</h2>
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md transition-colors capitalize',
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
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">RTP by Hour of Day</h2>
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

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">RTP by Day of Week</h2>
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
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 px-5 py-4 border-b border-zinc-800">
            Best Games by Personal RTP
          </h2>
          {byGame.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {byGame.slice(0, 8).map((g) => {
                const rtp = g['personal_rtp'] as number
                const fmt = formatRTP(rtp)
                return (
                  <div key={g['game_id'] as string} className="flex items-center justify-between px-5 py-3">
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

        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 px-5 py-4 border-b border-zinc-800">
            Platform Performance
          </h2>
          {byPlatform.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {byPlatform.map((p) => {
                const rtp = p['personal_rtp'] as number
                const net = p['net_profit'] as number
                const fmt = formatRTP(rtp)
                return (
                  <div key={p['platform_id'] as string} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-white">{p['platform_name'] as string}</p>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">Net P&L</p>
                        <p className={cn('text-sm font-medium tabular-nums', net >= 0 ? 'text-win' : 'text-loss')}>
                          {net >= 0 ? '+' : ''}{formatSC(net)} SC
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-300 px-5 py-4 border-b border-zinc-800">
            Bonus Analytics by Game
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium">Game</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Trigger Rate</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Avg Payout</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">RTP Contribution</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">vs Theoretical</th>
                </tr>
              </thead>
              <tbody>
                {bonusByGame.map((g) => {
                  const diff =
                    (g['actual_trigger_rate'] as number) - (g['theoretical_trigger_rate'] as number)
                  return (
                    <tr
                      key={g['game_id'] as string}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-white">{g['game_name'] as string}</td>
                      <td className="px-5 py-3 text-right text-zinc-300 tabular-nums">
                        1/{Math.round(100 / (g['actual_trigger_rate'] as number))}
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-300 tabular-nums">
                        {formatSC(g['avg_bonus_payout'] as number)} SC
                      </td>
                      <td className="px-5 py-3 text-right text-brand-300 tabular-nums">
                        {(g['rtp_contribution_pct'] as number).toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right tabular-nums',
                          diff > 0 ? 'text-win' : diff < 0 ? 'text-loss' : 'text-zinc-400'
                        )}
                      >
                        {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                        {diff > 0 ? (
                          <TrendingUp className="w-3 h-3 inline ml-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 inline ml-1" />
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
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[160px] flex items-center justify-center">
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  )
}
