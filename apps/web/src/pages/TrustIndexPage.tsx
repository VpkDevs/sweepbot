import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
} from 'recharts'
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Info,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, CHART_TOOLTIP_STYLE } from '../lib/utils'
import type { TrustFactor, TrustScore } from '@sweepbot/types'

// ─── Score color helpers ──────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 80) return 'bg-green-900/20 border-green-800'
  if (score >= 60) return 'bg-yellow-900/20 border-yellow-800'
  if (score >= 40) return 'bg-orange-900/20 border-orange-800'
  return 'bg-red-900/20 border-red-800'
}

function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 70) return 'Fair'
  if (score >= 60) return 'Watch'
  if (score >= 40) return 'Caution'
  return 'Risk'
}

function scoreWidthClass(score: number) {
  const rounded = Math.max(0, Math.min(100, Math.round(score / 5) * 5))
  return `score-width-${rounded}`
}

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const pct = score / 100
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} stroke="#27272a" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={
            score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
          }
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="z-10 text-center">
        <p className={cn('text-2xl font-black tabular-nums', scoreColor(score))}>{score}</p>
        <p className="-mt-0.5 text-[10px] text-zinc-500">{scoreLabel(score)}</p>
      </div>
    </div>
  )
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'stable') return <Minus className="h-4 w-4 text-zinc-500" />
  return trend === 'up' ? (
    <TrendingUp className="h-4 w-4 text-green-400" />
  ) : (
    <TrendingDown className="h-4 w-4 text-red-400" />
  )
}

// ─── Factor details ───────────────────────────────────────────────────────────

const FACTOR_META: Record<string, { description: string; weight: number }> = {
  redemption_speed: {
    description: 'Average processing time for payouts vs. stated timeline',
    weight: 20,
  },
  rejection_rate: {
    description: 'Percentage of redemptions rejected or clawed back',
    weight: 20,
  },
  tos_stability: {
    description: 'Frequency and severity of Terms of Service changes',
    weight: 15,
  },
  community_satisfaction: {
    description: 'Community ratings, reviews, and forum sentiment',
    weight: 15,
  },
  bonus_generosity: {
    description: 'Quality and frequency of promotional offers',
    weight: 10,
  },
  support_responsiveness: {
    description: 'Response time and resolution rate of customer support',
    weight: 10,
  },
  regulatory_standing: {
    description: 'Licensing status, regulatory compliance, and legal history',
    weight: 10,
  },
}

// ─── Platform trust card ──────────────────────────────────────────────────────

function PlatformTrustCard({
  entry,
  onSelect,
  selected,
}: {
  entry: TrustScore
  onSelect: () => void
  selected: boolean
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border bg-zinc-900 p-4 text-left transition-all hover:border-zinc-600',
        selected ? 'border-brand-500 ring-brand-500/20 ring-1' : 'border-zinc-800'
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <ScoreGauge score={entry.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{entry.platform_name}</p>
            <TrendBadge trend={entry.trend} />
          </div>
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-3 w-3',
                  i < Math.round(entry.score / 20)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-zinc-700'
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {entry.sample_count.toLocaleString()} data points
          </p>
        </div>
      </div>

      {/* Mini factor bars */}
      <div className="space-y-1">
        {entry.factors.slice(0, 3).map((f) => (
          <div key={f.factor} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[10px] capitalize text-zinc-600">
              {f.factor.replace(/_/g, ' ')}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={cn(
                  'h-full rounded-full',
                  scoreWidthClass(f.score),
                  f.score >= 80 ? 'bg-green-500' : f.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                )}
              />
            </div>
            <span className={cn('w-5 text-right text-[10px] tabular-nums', scoreColor(f.score))}>
              {f.score}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function TrustDetailPanel({ entry }: { entry: TrustScore }) {
  const radarData = entry.factors.map((f) => ({
    subject: f.factor
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    value: f.score,
    fullMark: 100,
  }))

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{entry.platform_name}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Last updated {new Date(entry.last_calculated_at).toLocaleDateString()}
          </p>
        </div>
        <div className={cn('rounded-lg border px-3 py-1.5 text-center', scoreBg(entry.score))}>
          <p className={cn('text-xl font-black tabular-nums', scoreColor(entry.score))}>
            {entry.score}
          </p>
          <p className="text-[10px] text-zinc-500">{scoreLabel(entry.score)}</p>
        </div>
      </div>

      {/* Radar */}
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 9 }} />
          <Radar name="Score" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Factor breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Factor Breakdown
        </h3>
        {entry.factors.map((f: TrustFactor) => {
          const meta = FACTOR_META[f.factor]
          return (
            <div key={f.factor} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs capitalize text-zinc-300">
                    {f.factor.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-zinc-600">({meta?.weight ?? 0}%)</span>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', scoreColor(f.score))}>
                  {f.score}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    scoreWidthClass(f.score),
                    f.score >= 80
                      ? 'bg-green-500'
                      : f.score >= 60
                        ? 'bg-yellow-500'
                        : f.score >= 40
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                  )}
                />
              </div>
              {meta && <p className="text-[10px] text-zinc-600">{meta.description}</p>}
            </div>
          )
        })}
      </div>

      {/* Recent TOS changes */}
      {entry.recent_tos_changes && entry.recent_tos_changes.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Recent TOS Changes
          </h3>
          <div className="space-y-2">
            {entry.recent_tos_changes.map((change, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  change.severity === 'major'
                    ? 'border border-red-800/50 bg-red-900/20'
                    : 'bg-zinc-800'
                )}
              >
                {change.severity === 'major' ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                )}
                <div className="flex-1">
                  <p className="text-zinc-300">{change.summary}</p>
                  {'detected_at' in change && typeof change.detected_at === 'string' && (
                    <p className="mt-0.5 text-zinc-600">
                      {new Date(change.detected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Distribution chart ───────────────────────────────────────────────────────

function ScoreDistributionChart({ scores }: { scores: TrustScore[] }) {
  const buckets = [
    { range: '0-20', min: 0, max: 20 },
    { range: '21-40', min: 21, max: 40 },
    { range: '41-60', min: 41, max: 60 },
    { range: '61-80', min: 61, max: 80 },
    { range: '81-100', min: 81, max: 100 },
  ].map((b) => ({
    range: b.range,
    count: scores.filter((s) => s.score >= b.min && s.score <= b.max).length,
  }))

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={buckets}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="range" tick={{ fill: '#71717a', fontSize: 10 }} />
        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => [v, 'Platforms']} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {buckets.map((b, i) => {
            const midpoint = parseInt(b.range.split('-')[0] ?? '0', 10) + 10
            const fill =
              midpoint >= 80
                ? '#22c55e'
                : midpoint >= 60
                  ? '#eab308'
                  : midpoint >= 40
                    ? '#f97316'
                    : '#ef4444'
            return <Cell key={i} fill={fill} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TrustIndexPage() {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'trend'>('score')

  const { data, isLoading } = useQuery({
    queryKey: ['trust', 'all'],
    queryFn: () => api.trust.list(),
    staleTime: 300_000,
  })

  const scores = ((data as { data?: TrustScore[] })?.data ?? []) as TrustScore[]

  const filtered = scores
    .filter((s) => s.platform_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'name') return a.platform_name.localeCompare(b.platform_name)
      // trend: up first
      const trendOrder = { up: 0, stable: 1, down: 2 }
      return (trendOrder[a.trend] ?? 1) - (trendOrder[b.trend] ?? 1)
    })

  const selectedEntry = selectedId ? scores.find((s) => s.platform_id === selectedId) : null

  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0

  const highCount = scores.filter((s) => s.score >= 80).length
  const riskCount = scores.filter((s) => s.score < 40).length

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">SweepBot Trust Index™</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Proprietary 0–100 platform trust scores built from real community data. The industry
          standard.
        </p>
      </div>

      {/* Methodology callout */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-brand-400 mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-white">How the Trust Index is calculated</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Each score is a weighted composite of 7 factors:{' '}
              <span className="text-zinc-300">Redemption Speed (20%)</span>,{' '}
              <span className="text-zinc-300">Rejection Rate (20%)</span>,{' '}
              <span className="text-zinc-300">TOS Stability (15%)</span>,{' '}
              <span className="text-zinc-300">Community Satisfaction (15%)</span>,{' '}
              <span className="text-zinc-300">Bonus Generosity (10%)</span>,{' '}
              <span className="text-zinc-300">Support Responsiveness (10%)</span>, and{' '}
              <span className="text-zinc-300">Regulatory Standing (10%)</span>. Scores update daily
              as new crowdsourced data arrives.
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Platforms Rated',
            value: scores.length,
            color: 'text-white',
            sub: 'and growing',
          },
          {
            label: 'Industry Average',
            value: avgScore,
            color: scoreColor(avgScore),
            sub: 'across all platforms',
          },
          {
            label: 'Trusted (80+)',
            value: highCount,
            color: 'text-green-400',
            sub: 'recommended platforms',
          },
          {
            label: 'High Risk (<40)',
            value: riskCount,
            color: 'text-red-400',
            sub: 'exercise caution',
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className={cn('mt-1 text-3xl font-black tabular-nums', color)}>{value}</p>
            <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>
          </div>
        ))}
      </div>

      {/* Score distribution */}
      {scores.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">Score Distribution</h2>
          <ScoreDistributionChart scores={scores} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Platform list */}
        <div className="space-y-4 lg:col-span-2">
          {/* Search + sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search platforms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2"
              />
            </div>
            <select
              aria-label="Sort trust index platforms"
              title="Sort trust index platforms"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="focus:ring-brand-500 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2"
            >
              <option value="score">Sort: Score</option>
              <option value="name">Sort: Name</option>
              <option value="trend">Sort: Trending</option>
            </select>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">No platforms match "{search}"</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((entry) => (
                <PlatformTrustCard
                  key={entry.platform_id}
                  entry={entry}
                  selected={selectedId === entry.platform_id}
                  onSelect={() =>
                    setSelectedId((prev) => (prev === entry.platform_id ? null : entry.platform_id))
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {selectedEntry ? (
            <TrustDetailPanel entry={selectedEntry} />
          ) : (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <Shield className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                Select a platform to see its full Trust Index breakdown.
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Score Guide
            </h3>
            {[
              { range: '90–100', label: 'Excellent', color: 'text-green-400', icon: CheckCircle2 },
              { range: '80–89', label: 'Good', color: 'text-green-400', icon: CheckCircle2 },
              { range: '60–79', label: 'Fair / Watch', color: 'text-yellow-400', icon: Clock },
              { range: '40–59', label: 'Caution', color: 'text-orange-400', icon: AlertTriangle },
              { range: '0–39', label: 'High Risk', color: 'text-red-400', icon: AlertTriangle },
            ].map(({ range, label, color, icon: Icon }) => (
              <div key={range} className="flex items-center gap-2">
                <Icon className={cn('h-3.5 w-3.5', color)} />
                <span className={cn('text-xs font-medium tabular-nums', color)}>{range}</span>
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Data moat CTA */}
          <div className="from-brand-950/60 border-brand-800/40 rounded-xl border bg-gradient-to-br to-zinc-900 p-4">
            <div className="flex items-start gap-2">
              <Shield className="text-brand-400 mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-brand-300 text-xs font-semibold">Become a certified platform</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Platforms with 80+ Trust Index scores can earn the SweepBot Certified badge. This
                  signal drives player acquisition.
                </p>
                <a
                  href="mailto:partnerships@sweepbot.io"
                  className="text-brand-400 hover:text-brand-300 mt-2 inline-block text-xs font-medium transition-colors"
                >
                  Partner with us →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
