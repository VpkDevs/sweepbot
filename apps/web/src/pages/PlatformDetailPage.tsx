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
import { cn, trustScoreColor, trustScoreLabel, timeAgo } from '../lib/utils'

export function PlatformDetailPage() {
  const { id } = useParams({ from: '/app/platforms/$id' })

  const { data, isLoading } = useQuery({
    queryKey: ['platforms', id],
    queryFn: () => api.platforms.get(id),
  })

  const { data: gamesData } = useQuery({
    queryKey: ['platforms', id, 'games'],
    queryFn: () => api.platforms.games(id, { pageSize: 10 }),
  })

  const { data: tosData } = useQuery({
    queryKey: ['platforms', id, 'tos-history'],
    queryFn: () => api.platforms.tosHistory(id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const platform = (data as Record<string, unknown>)
  const trustHistory = (platform?.['trustHistory'] as Record<string, unknown>[]) ?? []
  const redemptionStats = (platform?.['redemptionStats'] as Record<string, unknown>[]) ?? []
  const games = (gamesData as { data?: Record<string, unknown>[] })?.data ?? []
  const tosHistory = (tosData as { data?: Record<string, unknown>[] })?.data ?? []

  const score = platform?.['trust_score'] as number | null
  const trustHistoryChart = trustHistory
    .map((h) => ({
      date: new Date(h['calculated_at'] as string).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      score: Number(h['overall_score']),
    }))
    .reverse()

  const radarData = [
    { subject: 'Redemption Speed', value: Number(platform?.['redemption_speed_score'] ?? 0) },
    { subject: 'Rejection Rate', value: Number(platform?.['redemption_rejection_rate_score'] ?? 0) },
    { subject: 'TOS Stability', value: Number(platform?.['tos_stability_score'] ?? 0) },
    { subject: 'Bonus Generosity', value: Number(platform?.['bonus_generosity_score'] ?? 0) },
    { subject: 'Community', value: Number(platform?.['community_satisfaction_score'] ?? 0) },
    { subject: 'Support', value: Number(platform?.['support_responsiveness_score'] ?? 0) },
    { subject: 'Regulatory', value: Number(platform?.['regulatory_standing_score'] ?? 0) },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back */}
      <Link
        to="/platforms"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Platforms
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        {platform?.['logo_url'] ? (
          <img
            src={platform['logo_url'] as string}
            alt=""
            className="w-14 h-14 rounded-xl border border-zinc-800"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-7 h-7 text-zinc-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{platform?.['name'] as string}</h1>
            <span
              className={cn(
                'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                platform?.['status'] === 'active'
                  ? 'bg-green-900/40 text-green-400 border border-green-800'
                  : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
              )}
            >
              {platform?.['status'] as string}
            </span>
          </div>
          {platform?.['founded_year'] && (
            <p className="text-sm text-zinc-500 mt-0.5">Est. {platform['founded_year'] as number}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {platform?.['affiliate_url'] && (
            <a
              href={platform['affiliate_url'] as string}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Visit Platform
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Trust Index Hero */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
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
            <p className="text-zinc-500 text-sm">Score pending</p>
          )}
        </div>

        {/* Radar chart */}
        <div className="lg:col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Score Breakdown</h2>
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Trust Index History</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trustHistoryChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
              />
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">
              Community Redemption Times <span className="text-zinc-600 font-normal">(last 90 days)</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {redemptionStats.map((stat) => (
              <div key={stat['payment_method'] as string} className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-500 capitalize mb-1">
                  {(stat['payment_method'] as string).replace(/_/g, ' ')}
                </p>
                <p className="text-lg font-bold text-white tabular-nums">
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-300">Available Games</h2>
            <span className="text-xs text-zinc-500">{games.length} shown</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
            {games.map((game) => (
              <div key={game['id'] as string} className="bg-zinc-800/50 rounded-lg p-3 space-y-1.5">
                {game['thumbnail_url'] && (
                  <img
                    src={game['thumbnail_url'] as string}
                    alt=""
                    className="w-full h-20 object-cover rounded-md"
                  />
                )}
                <p className="text-xs font-medium text-white leading-tight">{game['name'] as string}</p>
                <p className="text-xs text-zinc-500">{game['provider_name'] as string}</p>
                {game['community_rtp_aggregate'] && (
                  <div className="flex items-center gap-1">
                    {Number(game['community_rtp_aggregate']) >= 96 ? (
                      <TrendingUp className="w-3 h-3 text-win" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-loss" />
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
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Terms of Service Changes</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {tosHistory.map((change) => (
              <div key={change['id'] as string} className="px-5 py-3 flex items-start gap-3">
                {change['change_severity'] === 'major' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{change['change_summary'] as string}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-600 capitalize">{change['section'] as string}</span>
                    <span className="text-xs text-zinc-600">
                      {timeAgo(change['captured_at'] as string)}
                    </span>
                    {change['change_severity'] === 'major' && (
                      <span className="text-xs text-yellow-500 font-medium">Major change</span>
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
