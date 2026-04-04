import { useParams, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Gamepad2,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts'
import { api } from '../lib/api'
import { cn, trustScoreColor, trustScoreLabel, timeAgo, CHART_TOOLTIP_STYLE } from '../lib/utils'

export function PlatformDetailPage() {
  const { platformId: id } = useParams({ from: '/app/platforms/$platformId' })

  const { data, isLoading } = useQuery({
    queryKey: ['platforms', id],
    queryFn: () => api.platforms.get(id),
  })

  const { data: gamesData } = useQuery({
    queryKey: ['platforms', id, 'games'],
    queryFn: () => api.platforms.games(id, { pageSize: '10' }),
  })

  const { data: tosData } = useQuery({
    queryKey: ['platforms', id, 'tos-history'],
    queryFn: () => api.platforms.tosHistory(id),
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const platform = data as Record<string, unknown>
  const trustHistory = (platform?.['trustHistory'] as Record<string, unknown>[]) ?? []
  const redemptionStats = (platform?.['redemptionStats'] as Record<string, unknown>[]) ?? []
  const games = (gamesData as { data?: Record<string, unknown>[] })?.data ?? []
  const tosHistory = (tosData as { data?: Record<string, unknown>[] })?.data ?? []

  const score = platform?.['trust_score'] as number | null
  const trustHistoryChart = trustHistory
    .map((h) => ({
      date: new Date(h['calculated_at'] as string).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      }),
      score: Number(h['overall_score']),
    }))
    .reverse()

  const radarData = [
    { subject: 'Redemption Speed', value: Number(platform?.['redemption_speed_score'] ?? 0) },
    {
      subject: 'Rejection Rate',
      value: Number(platform?.['redemption_rejection_rate_score'] ?? 0),
    },
    { subject: 'TOS Stability', value: Number(platform?.['tos_stability_score'] ?? 0) },
    { subject: 'Bonus Generosity', value: Number(platform?.['bonus_generosity_score'] ?? 0) },
    { subject: 'Community', value: Number(platform?.['community_satisfaction_score'] ?? 0) },
    { subject: 'Support', value: Number(platform?.['support_responsiveness_score'] ?? 0) },
    { subject: 'Regulatory', value: Number(platform?.['regulatory_standing_score'] ?? 0) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Back */}
      <Link
        to="/platforms"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        All Platforms
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {platform?.['logo_url'] ? (
          <img
            src={platform['logo_url'] as string}
            alt={`${platform?.['name']} logo`}
            className="h-14 w-14 rounded-xl border border-zinc-800"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800">
            <Gamepad2 className="h-7 w-7 text-zinc-600" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{platform?.['name'] as string}</h1>
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                platform?.['status'] === 'active'
                  ? 'border border-green-800 bg-green-900/40 text-green-400'
                  : 'border border-yellow-800 bg-yellow-900/40 text-yellow-400'
              )}
            >
              {platform?.['status'] as string}
            </span>
          </div>
          {!!platform?.['founded_year'] && (
            <p className="mt-0.5 text-sm text-zinc-500">
              Est. {platform['founded_year'] as number}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!!platform?.['affiliate_url'] && (
            <a
              href={platform['affiliate_url'] as string}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand-600 hover:bg-brand-500 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Visit Platform
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Trust Index Hero */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2">
            <Shield className="text-brand-400 h-5 w-5" />
            <span className="text-sm font-medium text-zinc-400">Trust Index Score</span>
          </div>
          {score !== null && score !== undefined ? (
            <>
              <p className={cn('text-6xl font-black tabular-nums', trustScoreColor(score))}>
                {score.toFixed(0)}
              </p>
              <p className={cn('text-sm font-semibold', trustScoreColor(score))}>
                {trustScoreLabel(score)}
              </p>
              <p className="text-xs text-zinc-600">
                Last updated {timeAgo(platform?.['trust_calculated_at'] as string)}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Score pending</p>
          )}
        </div>

        {/* Radar chart */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Score Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trust history chart */}
      {trustHistoryChart.length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">Trust Index History</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trustHistoryChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Trust Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Redemption stats */}
      {redemptionStats.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">
              Community Redemption Times{' '}
              <span className="font-normal text-zinc-600">(last 90 days)</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {redemptionStats.map((stat) => (
              <div key={stat['payment_method'] as string} className="rounded-lg bg-zinc-800/50 p-3">
                <p className="mb-1 text-xs capitalize text-zinc-500">
                  {(stat['payment_method'] as string).replace(/_/g, ' ')}
                </p>
                <p className="text-lg font-bold tabular-nums text-white">
                  {Number(stat['avg_days']).toFixed(1)}d
                </p>
                <p className="text-xs text-zinc-600">{stat['count'] as number} reports</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Games */}
      {games.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-300">Available Games</h2>
            <span className="text-xs text-zinc-500">{games.length} shown</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {games.map((game) => (
              <div key={game['id'] as string} className="space-y-1.5 rounded-lg bg-zinc-800/50 p-3">
                {!!game['thumbnail_url'] && (
                  <img
                    src={game['thumbnail_url'] as string}
                    alt={`${game['name']} thumbnail`}
                    className="h-20 w-full rounded-md object-cover"
                  />
                )}
                <p className="text-xs font-medium leading-tight text-white">
                  {game['name'] as string}
                </p>
                <p className="text-xs text-zinc-500">{game['provider_name'] as string}</p>
                {!!game['community_rtp_aggregate'] && (
                  <div className="flex items-center gap-1">
                    {Number(game['community_rtp_aggregate']) >= 96 ? (
                      <TrendingUp className="text-win h-3 w-3" />
                    ) : (
                      <TrendingDown className="text-loss h-3 w-3" />
                    )}
                    <span className="text-xs tabular-nums text-zinc-400">
                      {Number(game['community_rtp_aggregate']).toFixed(1)}% RTP
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOS History */}
      {tosHistory.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-4">
            <FileText className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Terms of Service Changes</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {tosHistory.map((change) => (
              <div key={change['id'] as string} className="flex items-start gap-3 px-5 py-3">
                {change['change_severity'] === 'major' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-300">{change['change_summary'] as string}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs capitalize text-zinc-600">
                      {change['section'] as string}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {timeAgo(change['captured_at'] as string)}
                    </span>
                    {change['change_severity'] === 'major' && (
                      <span className="text-xs font-medium text-yellow-500">Major change</span>
                    )}
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
