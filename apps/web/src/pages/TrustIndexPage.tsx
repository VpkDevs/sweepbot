/**
 * TrustIndexPage.tsx — SweepBot Trust Index
 *
 * Displays the community-powered 0–100 Trust Index for sweepstakes platforms.
 * All scores are informational only — not endorsements or play recommendations.
 *
 * Features:
 *  - Tier filter bar (Excellent / Good / Fair / Concerning / Poor)
 *  - Animated score gauge (SVG arc, stroke-dashoffset transition)
 *  - Inline 7-day sparklines on each platform card
 *  - Certification badge (Certified / Eligible / Provisional)
 *  - Alert subscription bell per platform
 *  - "My Platforms" toggle — only show platforms user has played
 *  - Full detail panel: RadarChart + score history line chart + TOS log
 *  - User personal data overlay (personal RTP, session count, vs. platform avg)
 *  - Percentile rank display
 *  - Animated loading skeletons
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Info,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bell,
  BellOff,
  User,
  Award,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, CHART_TOOLTIP_STYLE, formatRTP } from '../lib/utils'

// ============================================================================
// Types
// ============================================================================

type ScoreTier = 'excellent' | 'good' | 'fair' | 'concerning' | 'poor'
type CertStatus = 'eligible' | 'provisional' | 'not_eligible'

interface SparkPoint  { date: string; score: number }
interface TrustFactor { key: string; score: number; label: string; weight: number }
interface HistoryPoint { date: string; overall_score: number; redemption_speed: number; tos_stability: number; community_satisfaction: number }

interface TrustEntry {
  platform_id:                     string
  platform_name:                   string
  platform_slug:                   string
  logo_url:                        string | null
  platform_url:                    string
  affiliate_url:                   string | null
  overall_score:                   number
  redemption_speed_score:          number
  redemption_rejection_rate_score: number
  tos_stability_score:             number
  bonus_generosity_score:          number
  community_satisfaction_score:    number
  support_responsiveness_score:    number
  regulatory_standing_score:       number
  sample_size:                     number
  calculated_at:                   string
  rank:                            number
  score_tier:                      ScoreTier
  score_change_30d:                number
  certification_status:            CertStatus
  sparkline_7d:                    SparkPoint[] | null
  // User context (null if not authenticated or hasn't played)
  user_session_count:              number | null
  user_personal_rtp:               number | null
  user_has_alert:                  boolean | null
}

interface TrustDetail {
  platform:         TrustEntry & { percentile: number; rank: number; total_platforms: number }
  history:          HistoryPoint[]
  data_breakdown:   Array<{ factor: string; data_points: number; avg_processing_days: number | null; rating_count?: number }>
  tos_changes:      Array<{ captured_at: string; change_severity: string; change_summary: string }>
  user_context:     {
    has_played:       boolean
    session_count:    number
    total_spins:      number
    total_wagered:    number
    total_won:        number
    personal_rtp:     number | null
    rtp_vs_avg:       number | null
    best_session_rtp: number | null
    first_played_at:  string | null
    last_played_at:   string | null
    has_alert:        boolean
  } | null
}

// ============================================================================
// Score helpers
// ============================================================================

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 70) return 'text-green-400'
  if (score >= 55) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function scoreStroke(score: number): string {
  if (score >= 85) return '#10b981'
  if (score >= 70) return '#22c55e'
  if (score >= 55) return '#eab308'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-900/20 border-emerald-800/60'
  if (score >= 70) return 'bg-green-900/20 border-green-800/60'
  if (score >= 55) return 'bg-yellow-900/20 border-yellow-800/60'
  if (score >= 40) return 'bg-orange-900/20 border-orange-800/60'
  return 'bg-red-900/20 border-red-800/60'
}

function tierMeta(tier: ScoreTier): { label: string; color: string; bg: string; icon: typeof CheckCircle2 } {
  const map: Record<ScoreTier, ReturnType<typeof tierMeta>> = {
    excellent:  { label: 'Excellent',  color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700',  icon: ShieldCheck },
    good:       { label: 'Good',       color: 'text-green-400',   bg: 'bg-green-900/30 border-green-700',      icon: CheckCircle2 },
    fair:       { label: 'Fair',       color: 'text-yellow-400',  bg: 'bg-yellow-900/30 border-yellow-700',    icon: Info },
    concerning: { label: 'Concerning', color: 'text-orange-400',  bg: 'bg-orange-900/30 border-orange-700',    icon: AlertTriangle },
    poor:       { label: 'Poor',       color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700',          icon: ShieldAlert },
  }
  return map[tier]
}

const FACTOR_META: Record<string, { label: string; weight: number; description: string }> = {
  redemption_speed_score:          { label: 'Redemption Speed',    weight: 25, description: 'Days from request to receipt' },
  redemption_rejection_rate_score: { label: 'Rejection Rate',      weight: 20, description: 'Percentage of payouts rejected' },
  tos_stability_score:             { label: 'TOS Stability',       weight: 15, description: 'Frequency of Terms changes' },
  community_satisfaction_score:    { label: 'Community Rating',    weight: 15, description: 'Weighted average star rating' },
  support_responsiveness_score:    { label: 'Support Speed',       weight: 10, description: 'Support resolution time' },
  regulatory_standing_score:       { label: 'Regulatory Standing', weight: 10, description: 'Licensing & compliance status' },
  bonus_generosity_score:          { label: 'Bonus Generosity',    weight: 5,  description: 'Wagering requirements vs. bonus' },
}

function entryToFactors(entry: TrustEntry): TrustFactor[] {
  return Object.entries(FACTOR_META).map(([key, meta]) => ({
    key,
    score: Math.round((entry[key as keyof TrustEntry] as number) ?? 0),
    label: meta.label,
    weight: meta.weight,
  })).sort((a, b) => b.weight - a.weight)
}

// ============================================================================
// Animated Score Gauge
// ============================================================================

function ScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const dim        = size === 'lg' ? 140 : size === 'md' ? 112 : 72
  const radius     = size === 'lg' ? 52  : size === 'md' ? 40  : 26
  const strokeW    = size === 'lg' ? 10  : size === 'md' ? 8   : 5
  const circumference = 2 * Math.PI * radius
  const offset        = circumference * (1 - score / 100)
  const textSize      = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-base'

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: dim, height: dim }}>
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${dim} ${dim}`}>
        {/* Track */}
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          stroke="#27272a" strokeWidth={strokeW} fill="none"
        />
        {/* Arc */}
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          stroke={scoreStroke(score)}
          strokeWidth={strokeW}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${scoreStroke(score)}66)` }}
        />
      </svg>
      <div className="text-center z-10 pointer-events-none">
        <p className={cn(textSize, 'font-black tabular-nums leading-none', scoreColor(score))}>
          {Math.round(score)}
        </p>
        <p className="text-[9px] text-zinc-500 mt-0.5 leading-none">/100</p>
      </div>
    </div>
  )
}

// ============================================================================
// Inline Sparkline (SVG polyline — no recharts overhead)
// ============================================================================

function Sparkline({ points, trend }: { points: SparkPoint[]; trend: number }) {
  if (!points || points.length < 2) return <div className="w-20 h-8" />

  const scores = points.map((p) => p.score)
  const min    = Math.min(...scores) - 3
  const max    = Math.max(...scores) + 3
  const range  = max - min || 1
  const W = 80, H = 32

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W
    const y = H - ((p.score - min) / range) * H
    return `${x},${y}`
  }).join(' ')

  const color = trend > 0.5 ? '#22c55e' : trend < -0.5 ? '#ef4444' : '#71717a'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-20 h-8" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={W}
        cy={H - ((scores[scores.length - 1]! - min) / range) * H}
        r="2"
        fill={color}
      />
    </svg>
  )
}

// ============================================================================
// Certification Badge
// ============================================================================

function CertBadge({ status }: { status: CertStatus }) {
  if (status === 'not_eligible') return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
        status === 'eligible'
          ? 'bg-brand-900/40 border-brand-700 text-brand-300'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
      )}
      title={status === 'eligible' ? 'Eligible for SweepBot Certification' : 'Approaching certification threshold'}
    >
      <Award className="w-2.5 h-2.5" />
      {status === 'eligible' ? 'Cert Eligible' : 'Provisional'}
    </div>
  )
}

// ============================================================================
// Platform Trust Card
// ============================================================================

function PlatformTrustCard({
  entry,
  onSelect,
  selected,
  onAlertToggle,
}: {
  entry: TrustEntry
  onSelect: () => void
  selected: boolean
  onAlertToggle: (platformId: string, current: boolean) => void
}) {
  const tier       = tierMeta(entry.score_tier)
  const TierIcon   = tier.icon
  const trendDelta = entry.score_change_30d ?? 0

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left bg-zinc-900 rounded-xl border p-4 transition-all duration-200',
        'hover:border-zinc-600 hover:bg-zinc-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        selected ? 'border-brand-500 ring-1 ring-brand-500/20 bg-brand-950/10' : 'border-zinc-800'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Gauge */}
        <ScoreGauge score={entry.overall_score} size="md" />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + rank */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {entry.platform_name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={cn('text-[10px] font-medium', tier.color)}>
                  #{entry.rank} · {tier.label}
                </span>
                <CertBadge status={entry.certification_status} />
              </div>
            </div>
            {/* Alert bell */}
            {entry.user_has_alert != null && (
              <button
                onClick={(e) => { e.stopPropagation(); onAlertToggle(entry.platform_id, entry.user_has_alert ?? false) }}
                className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5 flex-shrink-0"
                title={entry.user_has_alert ? 'Remove score alert' : 'Set score alert'}
                aria-label={entry.user_has_alert ? 'Remove score alert' : 'Set score alert'}
              >
                {entry.user_has_alert
                  ? <Bell className="w-3.5 h-3.5 text-brand-400" />
                  : <BellOff className="w-3.5 h-3.5" />
                }
              </button>
            )}
          </div>

          {/* Sparkline + 30d delta */}
          <div className="flex items-center justify-between">
            <Sparkline points={entry.sparkline_7d ?? []} trend={trendDelta} />
            <div className={cn(
              'flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
              trendDelta > 0 ? 'text-green-400' : trendDelta < 0 ? 'text-red-400' : 'text-zinc-500'
            )}>
              {trendDelta > 0.3
                ? <TrendingUp className="w-3 h-3" />
                : trendDelta < -0.3
                  ? <TrendingDown className="w-3 h-3" />
                  : <Minus className="w-3 h-3" />}
              {trendDelta > 0 ? '+' : ''}{trendDelta.toFixed(1)}
              <span className="text-zinc-600 font-normal">30d</span>
            </div>
          </div>

          {/* Sample size + user played badge */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-600">
              {entry.sample_size.toLocaleString()} data pts
            </p>
            {(entry.user_session_count ?? 0) > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-brand-900/30 rounded text-[9px] text-brand-400 border border-brand-800/40">
                <User className="w-2.5 h-2.5" />
                You've played
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mini factor bars — top 3 by weight */}
      <div className="mt-3 space-y-1">
        {entryToFactors(entry).slice(0, 3).map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 w-24 shrink-0 truncate">{f.label}</span>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:      `${f.score}%`,
                  background: scoreStroke(f.score),
                }}
              />
            </div>
            <span className={cn('text-[10px] tabular-nums w-6 text-right', scoreColor(f.score))}>
              {f.score}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

// ============================================================================
// Detail Panel
// ============================================================================

function TrustDetailPanel({
  platformId,
  entry,
}: {
  platformId: string
  entry: TrustEntry
}) {
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['trust', 'detail', platformId],
    queryFn:  () => api.trust.get(platformId),
    staleTime: 180_000,
  })

  const detail = (detailData as { data?: TrustDetail })?.data

  const factors = entryToFactors(entry)
  const tier    = tierMeta(entry.score_tier)
  const TierIcon = tier.icon

  const radarData = factors.map((f) => ({
    subject:  f.label.replace('Rating', 'Sat.').replace('Standing', 'Reg.').replace('Generosity', 'Bonus').replace('Responsiveness', 'Support'),
    value:    f.score,
    fullMark: 100,
  }))

  const historyPoints = (detail?.history ?? []) as HistoryPoint[]
  const userCtx       = detail?.user_context ?? null
  const tosChanges    = (detail?.tos_changes ?? []).slice(0, 8)
  const percentile    = (detail?.platform as (TrustEntry & { percentile?: number; rank: number; total_platforms: number }) | undefined)?.percentile

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className={cn('px-5 py-4 border-b border-zinc-800/50', scoreBg(entry.overall_score))}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{entry.platform_name}</h2>
              <CertBadge status={entry.certification_status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TierIcon className={cn('w-3.5 h-3.5', tier.color)} />
              <span className={cn('text-xs font-semibold', tier.color)}>{tier.label}</span>
              <span className="text-zinc-600 text-xs">·</span>
              <span className="text-xs text-zinc-500">
                Rank #{entry.rank}
                {percentile != null && ` · Top ${(100 - percentile).toFixed(0)}%`}
              </span>
            </div>
          </div>
          <ScoreGauge score={entry.overall_score} size="lg" />
        </div>

        {/* 30-day trend */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <div className={cn(
            'flex items-center gap-1 font-semibold',
            entry.score_change_30d > 0 ? 'text-green-400' : entry.score_change_30d < 0 ? 'text-red-400' : 'text-zinc-500'
          )}>
            {entry.score_change_30d > 0
              ? <TrendingUp className="w-3 h-3" />
              : entry.score_change_30d < 0
                ? <TrendingDown className="w-3 h-3" />
                : <Minus className="w-3 h-3" />}
            {entry.score_change_30d > 0 ? '+' : ''}{(entry.score_change_30d ?? 0).toFixed(1)} pts (30d)
          </div>
          <span className="text-zinc-600">
            {entry.sample_size.toLocaleString()} data points
          </span>
          {entry.platform_url && (
            <a
              href={entry.affiliate_url ?? entry.platform_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors ml-auto"
            >
              Visit <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* User personal data overlay */}
        {userCtx && userCtx.has_played && (
          <div className="bg-brand-950/30 border border-brand-800/40 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <User className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-xs font-semibold text-brand-300">Your Stats on This Platform</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-zinc-500">Sessions</p>
                <p className="text-sm font-bold text-white">{userCtx.session_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Personal RTP</p>
                <p className={cn('text-sm font-bold tabular-nums', userCtx.personal_rtp != null ? (userCtx.personal_rtp >= 95 ? 'text-green-400' : userCtx.personal_rtp >= 85 ? 'text-yellow-400' : 'text-red-400') : 'text-zinc-500')}>
                  {userCtx.personal_rtp != null ? `${userCtx.personal_rtp.toFixed(2)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">vs. Avg</p>
                <p className={cn('text-sm font-bold tabular-nums', (userCtx.rtp_vs_avg ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {userCtx.rtp_vs_avg != null
                    ? `${userCtx.rtp_vs_avg >= 0 ? '+' : ''}${userCtx.rtp_vs_avg.toFixed(1)}%`
                    : '—'
                  }
                </p>
              </div>
            </div>
            {userCtx.first_played_at && (
              <p className="text-[10px] text-zinc-600 mt-2">
                First played {new Date(userCtx.first_played_at).toLocaleDateString()} ·{' '}
                {userCtx.total_spins.toLocaleString()} total spins
              </p>
            )}
          </div>
        )}

        {/* Radar chart */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Factor Profile</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
              <PolarGrid stroke="#3f3f46" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#71717a', fontSize: 9 }}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke={scoreStroke(entry.overall_score)}
                fill={scoreStroke(entry.overall_score)}
                fillOpacity={0.15}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: number) => [`${v}/100`, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Factor breakdown */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">All 7 Factors</h3>
          {factors.map((f) => {
            const meta = FACTOR_META[f.key]
            return (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-zinc-300">{f.label}</span>
                    <span className="text-[10px] text-zinc-600 ml-1.5">{meta?.weight ?? 0}% weight</span>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', scoreColor(f.score))}>
                    {f.score}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${f.score}%`, background: scoreStroke(f.score) }}
                  />
                </div>
                {meta && (
                  <p className="text-[10px] text-zinc-600">{meta.description}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* 90-day score history chart */}
        {historyPoints.length > 1 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              90-Day Score History
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={historyPoints} margin={{ top: 4, right: 4, left: -24, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#52525b', fontSize: 9 }}
                  tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 9 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
                  formatter={(v: number, name: string) => [
                    `${v.toFixed(1)}`,
                    name === 'overall_score' ? 'Overall' : name.replace(/_/g, ' '),
                  ]}
                />
                <ReferenceLine y={85} stroke="#10b98144" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#22c55e44" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="overall_score"
                  stroke={scoreStroke(entry.overall_score)}
                  strokeWidth={2}
                  dot={false}
                  name="overall_score"
                />
                <Line
                  type="monotone"
                  dataKey="redemption_speed"
                  stroke="#8b5cf6"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="3 3"
                  name="redemption_speed"
                />
                <Line
                  type="monotone"
                  dataKey="tos_stability"
                  stroke="#06b6d4"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="3 3"
                  name="tos_stability"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-1">
              {[
                { color: scoreStroke(entry.overall_score), label: 'Overall' },
                { color: '#8b5cf6', label: 'Redemption Speed' },
                { color: '#06b6d4', label: 'TOS Stability' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-4 h-0.5" style={{ background: color }} />
                  <span className="text-[9px] text-zinc-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOS change log */}
        {tosChanges.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Recent TOS Changes
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {tosChanges.map((change, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 px-3 py-2 rounded-lg text-xs border',
                    change.change_severity === 'major'
                      ? 'bg-red-900/20 border-red-800/50'
                      : change.change_severity === 'moderate'
                        ? 'bg-orange-900/20 border-orange-800/40'
                        : 'bg-zinc-800/60 border-zinc-700/40'
                  )}
                >
                  {change.change_severity === 'major'
                    ? <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    : <Info className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 leading-relaxed">{change.change_summary}</p>
                    <p className="text-zinc-600 mt-0.5 text-[10px]">
                      {new Date(change.captured_at).toLocaleDateString()} · {change.change_severity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="space-y-2">
            {[100, 80, 60].map((w) => (
              <div key={w} className={`h-3 rounded-full bg-zinc-800 animate-pulse`} style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* Methodology note */}
        <div className="pt-2 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Trust Index scores are informational only and not endorsements or play recommendations.
            Scores based on community-submitted data. Updated daily.{' '}
            <a href="https://sweepbot.app/trust-index/methodology" className="text-brand-500 hover:text-brand-400">
              See methodology →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Score Distribution Chart
// ============================================================================

function ScoreDistributionChart({ distribution }: { distribution: Array<{ tier: string; count: number }> }) {
  const tierOrder = ['excellent', 'good', 'fair', 'concerning', 'poor']
  const data = tierOrder.map((tier) => {
    const found = distribution.find((d) => d.tier === tier)
    const meta  = tierMeta(tier as ScoreTier)
    return {
      tier:  meta.label,
      count: found?.count ?? 0,
      color: scoreStroke(tier === 'excellent' ? 90 : tier === 'good' ? 75 : tier === 'fair' ? 62 : tier === 'concerning' ? 47 : 20),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="tier" tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v: number) => [v, 'Platforms']}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ============================================================================
// Loading skeleton
// ============================================================================

function CardSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 h-52 animate-pulse space-y-3">
      <div className="flex gap-3">
        <div className="w-28 h-28 rounded-full bg-zinc-800 shrink-0" />
        <div className="flex-1 space-y-2 pt-2">
          <div className="h-3 bg-zinc-800 rounded w-3/4" />
          <div className="h-2 bg-zinc-800 rounded w-1/2" />
          <div className="h-8 bg-zinc-800 rounded w-full mt-2" />
        </div>
      </div>
      <div className="space-y-1.5">
        {[70, 55, 40].map((w) => (
          <div key={w} className="flex gap-2 items-center">
            <div className="h-2 bg-zinc-800 rounded w-20" />
            <div className={`h-1 bg-zinc-800 rounded flex-1`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Tier Filter Bar
// ============================================================================

const ALL_TIERS: ScoreTier[] = ['excellent', 'good', 'fair', 'concerning', 'poor']

function TierFilterBar({
  active,
  onChange,
}: {
  active: ScoreTier | null
  onChange: (tier: ScoreTier | null) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-3 py-1 text-xs rounded-full border transition-all',
          active == null
            ? 'bg-zinc-700 border-zinc-600 text-white'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
        )}
      >
        All
      </button>
      {ALL_TIERS.map((tier) => {
        const meta = tierMeta(tier)
        const Icon = meta.icon
        return (
          <button
            key={tier}
            onClick={() => onChange(active === tier ? null : tier)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-all',
              active === tier
                ? cn(meta.bg, meta.color, 'font-semibold')
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            )}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export function TrustIndexPage() {
  const [search,       setSearch]       = useState('')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [tierFilter,   setTierFilter]   = useState<ScoreTier | null>(null)
  const [myPlatforms,  setMyPlatforms]  = useState(false)
  const [sortBy,       setSortBy]       = useState<string>('overall_score')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['trust', 'list', sortBy, tierFilter, myPlatforms],
    queryFn:  () => {
      const p: Record<string, string> = {}
      if (sortBy) p.sortBy = sortBy
      if (tierFilter) p.tier = tierFilter
      if (myPlatforms) p.myPlatforms = 'true'
      return api.trust.list(Object.keys(p).length ? p : undefined)
    },
    staleTime: 300_000,
  })

  const { data: leaderboardData } = useQuery({
    queryKey: ['trust', 'leaderboard'],
    queryFn:  () => api.trust.leaderboard(),
    staleTime: 600_000,
  })

  const alertMutation = useMutation({
    mutationFn: ({ platformId, remove }: { platformId: string; remove: boolean }) =>
      remove
        ? api.trust.removeAlert(platformId)
        : api.trust.addAlert({ platform_id: platformId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trust', 'list'] })
    },
  })

  const handleAlertToggle = useCallback((platformId: string, current: boolean) => {
    alertMutation.mutate({ platformId, remove: current })
  }, [alertMutation])

  const entries  = ((data as { data?: TrustEntry[] })?.data ?? []) as TrustEntry[]
  const leaderboard = leaderboardData as {
    data?: {
      top_platforms:      Array<{ id: string; name: string; overall_score: number; rank: number }>
      score_distribution: Array<{ tier: string; count: number }>
      global_stats:       { avg_score: number; median_score: number; total_scored: number; min_score: number; max_score: number }
    }
  } | undefined

  const distribution = leaderboard?.data?.score_distribution ?? []
  const globalStats  = leaderboard?.data?.global_stats

  // Client-side search filter (server handles tier/sort)
  const filtered = entries.filter((e) =>
    e.platform_name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedEntry = selectedId ? entries.find((e) => e.platform_id === selectedId) : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">SweepBot Trust Index™</h1>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Community-powered 0–100 platform trust scores based on real redemption data, TOS monitoring, and ratings.
            Informational only — not gambling advice.
          </p>
        </div>
        <a
          href="https://sweepbot.app/trust-index/methodology"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap mt-1 flex-shrink-0"
        >
          Methodology <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Global stats bar */}
      {globalStats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Platforms Rated',   value: globalStats.total_scored, suffix: '' },
            { label: 'Industry Average',  value: globalStats.avg_score.toFixed(1), suffix: '/100', color: scoreColor(globalStats.avg_score) },
            { label: 'Median Score',      value: globalStats.median_score.toFixed(1), suffix: '/100', color: scoreColor(globalStats.median_score) },
            { label: 'Highest Score',     value: globalStats.max_score.toFixed(1), suffix: '/100', color: 'text-emerald-400' },
            { label: 'Lowest Score',      value: globalStats.min_score.toFixed(1), suffix: '/100', color: 'text-red-400' },
          ].map(({ label, value, suffix, color }) => (
            <div key={label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</p>
              <p className={cn('text-xl font-black tabular-nums mt-0.5', color ?? 'text-white')}>
                {value}<span className="text-xs text-zinc-600">{suffix}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Score distribution */}
      {distribution.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-300">Score Distribution</h2>
            <p className="text-xs text-zinc-600">All active platforms</p>
          </div>
          <ScoreDistributionChart distribution={distribution} />
        </div>
      )}

      {/* Tier filter + controls */}
      <div className="space-y-3">
        <TierFilterBar active={tierFilter} onChange={setTierFilter} />

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search platforms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            onClick={() => setMyPlatforms((p) => !p)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all',
              myPlatforms
                ? 'bg-brand-900/40 border-brand-700 text-brand-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            )}
          >
            <User className="w-3.5 h-3.5" />
            My Platforms
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort platforms by"
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="overall_score">Sort: Score</option>
            <option value="redemption_speed">Sort: Redemption Speed</option>
            <option value="tos_stability">Sort: TOS Stability</option>
            <option value="calculated_at">Sort: Recently Updated</option>
          </select>

          {(search || tierFilter || myPlatforms) && (
            <button
              onClick={() => { setSearch(''); setTierFilter(null); setMyPlatforms(false) }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-700 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Platform grid */}
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center space-y-3">
              <Shield className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-500">
                {search ? `No platforms match "${search}"` : 'No platforms in this tier yet.'}
              </p>
              <button
                onClick={() => { setSearch(''); setTierFilter(null); setMyPlatforms(false) }}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-600">
                {filtered.length} platform{filtered.length !== 1 ? 's' : ''}
                {tierFilter ? ` with ${tierMeta(tierFilter).label} rating` : ''}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {filtered.map((entry) => (
                  <PlatformTrustCard
                    key={entry.platform_id}
                    entry={entry}
                    selected={selectedId === entry.platform_id}
                    onSelect={() =>
                      setSelectedId((prev) => prev === entry.platform_id ? null : entry.platform_id)
                    }
                    onAlertToggle={handleAlertToggle}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Detail panel or placeholder */}
          {selectedEntry ? (
            <TrustDetailPanel platformId={selectedEntry.platform_id} entry={selectedEntry} />
          ) : (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center space-y-3">
              <ShieldCheck className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-sm text-zinc-500">
                Select a platform to see its full Trust Index breakdown, 90-day history, and your personal performance on it.
              </p>
            </div>
          )}

          {/* Score guide */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Score Guide</h3>
            {([
              { range: '85–100', label: 'Excellent', score: 90, Icon: ShieldCheck },
              { range: '70–84',  label: 'Good',      score: 75, Icon: CheckCircle2 },
              { range: '55–69',  label: 'Fair',       score: 62, Icon: Info },
              { range: '40–54',  label: 'Concerning', score: 47, Icon: AlertTriangle },
              { range: '0–39',   label: 'Poor',       score: 20, Icon: ShieldAlert },
            ] as const).map(({ range, label, score, Icon }) => (
              <div key={range} className="flex items-center gap-2">
                <Icon className={cn('w-3.5 h-3.5 shrink-0', scoreColor(score))} />
                <span className={cn('text-xs tabular-nums font-mono w-14', scoreColor(score))}>{range}</span>
                <span className="text-xs text-zinc-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Certification CTA */}
          <div className="bg-gradient-to-br from-brand-950/50 to-zinc-900 rounded-xl border border-brand-800/30 p-4">
            <div className="flex items-start gap-2.5">
              <Award className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-brand-300">SweepBot Certified Program</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Platforms scoring 75+ with sufficient data can earn the Certified badge. Certification is
                  earned — not purchased. Annual review, revocable if score drops below 65.
                </p>
                <a
                  href="mailto:partnerships@sweepbot.io"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Learn about certification <ChevronRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="px-1">
            <p className="text-[10px] text-zinc-700 leading-relaxed">
              Trust Index scores are community-derived and informational only. They do not constitute
              endorsements, investment advice, or recommendations to engage in sweepstakes play.
              SweepBot is a data tracking tool, not a gambling product.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
