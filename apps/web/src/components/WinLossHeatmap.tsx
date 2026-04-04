import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, TrendingUp, TrendingDown, BarChart3, Filter } from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { SpotlightCard } from './fx/SpotlightCard'
import { ScrollReveal } from './fx/ScrollReveal'

// ── Types ─────────────────────────────────────────────────────────────────────

type HeatmapData = {
  day: number // 0-6 (Sunday-Saturday)
  hour: number // 0-23
  sessions: number
  totalWagered: number
  totalWon: number
  netResult: number
  avgRtp: number
  winRate: number // percentage of winning sessions
}

type HeatmapProps = {
  className?: string
  timeRange?: '7d' | '30d' | '90d'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const METRICS = [
  {
    key: 'netResult',
    label: 'Net P&L',
    icon: TrendingUp,
    format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} SC`,
  },
  { key: 'avgRtp', label: 'Avg RTP', icon: BarChart3, format: (v: number) => `${v.toFixed(1)}%` },
  {
    key: 'winRate',
    label: 'Win Rate',
    icon: TrendingUp,
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  { key: 'sessions', label: 'Sessions', icon: Calendar, format: (v: number) => v.toString() },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function WinLossHeatmap({ className, timeRange = '30d' }: HeatmapProps) {
  const [selectedMetric, setSelectedMetric] = useState<(typeof METRICS)[number]['key']>('netResult')
  const [selectedRange, setSelectedRange] = useState(timeRange)

  const { data: heatmapData, isLoading } = useQuery({
    queryKey: ['analytics', 'heatmap', selectedRange],
    queryFn: () => api.features.heatmap({ timeRange: selectedRange }),
  })

  if (isLoading) {
    return <HeatmapSkeleton className={className} />
  }

  const data = (heatmapData as HeatmapData[]) || []
  const metric = METRICS.find((m) => m.key === selectedMetric)!

  // Create 2D grid for heatmap
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => null as HeatmapData | null)
  )

  // Populate grid with data
  data.forEach((item) => {
    if (item.day >= 0 && item.day <= 6 && item.hour >= 0 && item.hour <= 23) {
      grid[item.day]![item.hour] = item
    }
  })

  // Calculate min/max for color scaling
  const values = data.map((d) => d[selectedMetric] as number).filter((v) => !isNaN(v))
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = maxValue - minValue

  const getIntensity = (value: number): number => {
    if (range === 0) return 0.5
    return (value - minValue) / range
  }

  const getCellColor = (cell: HeatmapData | null): string => {
    if (!cell || cell.sessions === 0) return 'bg-zinc-800/20'

    const value = cell[selectedMetric] as number
    const intensity = getIntensity(value)

    if (selectedMetric === 'netResult') {
      // Green for positive, red for negative
      if (value >= 0) {
        return `bg-emerald-500/${Math.round(20 + intensity * 60)}`
      } else {
        return `bg-red-500/${Math.round(20 + (1 - intensity) * 60)}`
      }
    } else {
      // Blue gradient for other metrics
      return `bg-brand-500/${Math.round(10 + intensity * 70)}`
    }
  }

  return (
    <SpotlightCard className={cn('glass-card rounded-2xl p-6', className)}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-brand-500/10 flex h-8 w-8 items-center justify-center rounded-xl">
            <BarChart3 className="text-brand-400 h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Win/Loss Heatmap</h3>
            <p className="text-xs text-zinc-500">Performance by time of day and day of week</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="glass-card-static focus:ring-brand-500/50 rounded-lg border-0 bg-transparent px-3 py-1.5 text-sm text-zinc-300 focus:ring-1"
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>

          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as typeof selectedMetric)}
            className="glass-card-static focus:ring-brand-500/50 rounded-lg border-0 bg-transparent px-3 py-1.5 text-sm text-zinc-300 focus:ring-1"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-4">
        {/* Hour labels */}
        <div className="flex">
          <div className="w-12" /> {/* Space for day labels */}
          <div className="grid-cols-24 grid flex-1 gap-0.5">
            {HOURS.map((hour) => (
              <div key={hour} className="text-center">
                <span className="text-[10px] font-medium text-zinc-600">
                  {hour === 0 ? '12a' : hour <= 12 ? `${hour}a` : `${hour - 12}p`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="space-y-1">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center">
              {/* Day label */}
              <div className="w-12 pr-3 text-right">
                <span className="text-xs font-medium text-zinc-500">{day}</span>
              </div>

              {/* Hour cells */}
              <div className="grid-cols-24 grid flex-1 gap-0.5">
                {HOURS.map((hour) => {
                  const cell = grid[dayIndex]![hour]
                  const hasData = cell && cell.sessions > 0

                  return (
                    <div
                      key={hour}
                      className={cn(
                        'group relative aspect-square cursor-pointer rounded-sm transition-all duration-200',
                        getCellColor(cell),
                        hasData ? 'hover:z-10 hover:scale-110' : 'opacity-50'
                      )}
                      title={
                        hasData
                          ? `${day} ${hour}:00 - ${metric.format(cell[selectedMetric] as number)} (${cell.sessions} sessions)`
                          : `${day} ${hour}:00 - No data`
                      }
                    >
                      {hasData && (
                        <div className="absolute inset-0 rounded-sm ring-1 ring-white/10 transition-all group-hover:ring-white/30" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between border-t border-white/[0.04] pt-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <span>Hover cells for details</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Less</span>
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-3 w-3 rounded-sm',
                    selectedMetric === 'netResult'
                      ? i < 2
                        ? `bg-red-500/${20 + i * 30}`
                        : i === 2
                          ? 'bg-zinc-600'
                          : `bg-emerald-500/${20 + (i - 2) * 30}`
                      : `bg-brand-500/${10 + i * 20}`
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">More</span>
          </div>
        </div>

        {/* Summary Stats */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-4 lg:grid-cols-4">
            {METRICS.map((m) => {
              const Icon = m.icon
              const total = data.reduce((sum, d) => sum + (d[m.key] as number), 0)
              const avg = total / data.length

              return (
                <div key={m.key} className="glass-card-static rounded-xl p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500">{m.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {m.format(m.key === 'sessions' ? total : avg)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50">
            <BarChart3 className="h-6 w-6 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500">
            No session data available for the selected time range.
          </p>
        </div>
      )}
    </SpotlightCard>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HeatmapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card rounded-2xl p-6', className)}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="shimmer h-8 w-8 rounded-xl bg-zinc-700" />
          <div>
            <div className="shimmer mb-1 h-4 w-32 rounded bg-zinc-700" />
            <div className="shimmer h-3 w-48 rounded bg-zinc-800" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="shimmer h-8 w-20 rounded-lg bg-zinc-700" />
          <div className="shimmer h-8 w-24 rounded-lg bg-zinc-700" />
        </div>
      </div>

      <div className="space-y-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center">
            <div className="shimmer mr-3 h-4 w-12 rounded bg-zinc-800" />
            <div className="grid-cols-24 grid flex-1 gap-0.5">
              {Array.from({ length: 24 }, (_, j) => (
                <div key={j} className="shimmer aspect-square rounded-sm bg-zinc-800/30" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
