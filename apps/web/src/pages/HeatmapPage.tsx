import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type HeatmapDay = {
  day: string
  net: number
  sessions: number
  wagered: number
  won: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Selects a Tailwind CSS background + hover class string representing a day's net P&L category.
 *
 * @param net - The day's net profit/loss (P&L). `undefined` indicates no data for the day.
 * @returns A CSS class string containing background and hover classes corresponding to the net category (gain, loss, neutral, or no data).
 */
function getCellColor(net: number | undefined): string {
  if (net === undefined) return 'bg-zinc-800 hover:bg-zinc-700'
  if (net > 500)  return 'bg-emerald-500 hover:bg-emerald-400'
  if (net > 100)  return 'bg-emerald-600/80 hover:bg-emerald-500'
  if (net > 0)    return 'bg-emerald-700/60 hover:bg-emerald-600'
  if (net < -500) return 'bg-red-500 hover:bg-red-400'
  if (net < -100) return 'bg-red-600/80 hover:bg-red-500'
  if (net < 0)    return 'bg-red-700/60 hover:bg-red-600'
  return 'bg-zinc-600 hover:bg-zinc-500' // played, net 0
}

/**
 * Builds a calendar grid of weeks that covers the specified year.
 *
 * @param year - The target year (e.g., 2026) to generate the calendar for
 * @returns An array of weeks where each week is an array of seven Date objects; weeks start on Sunday and the grid begins on the Sunday on or before January 1 and extends until at least the end of December of `year` (dates outside the target year are included to fill full weeks)
 */
function buildCalendarGrid(year: number): Date[][] {
  const jan1 = new Date(year, 0, 1)
  const start = new Date(jan1)
  // Step back to the nearest Sunday
  start.setDate(start.getDate() - start.getDay())

  const weeks: Date[][] = []
  const cursor = new Date(start)

  // Build until we've covered all of December
  while (true) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    // Stop after we've passed Dec 31 of the target year
    if (cursor.getFullYear() > year) break
  }

  return weeks
}

/**
 * Render an interactive yearly activity heatmap displaying daily P&L, session counts, and wagered amounts.
 *
 * Shows year navigation, aggregated stats (sessions, win days, loss days, total net), a calendar grid with color-coded day cells based on net P&L, a hover detail panel for individual days, and a legend. Prevents navigating to future years and hides cells outside the selected year or in the future.
 *
 * @returns The JSX element for the Heatmap page.
 */

export function HeatmapPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['features', 'heatmap', year],
    queryFn: () => api.features.heatmap({ year: String(year) }),
  })

  const heatmapData = data as HeatmapDay[]
  const dayMap = new Map<string, HeatmapDay>(heatmapData.map((d) => [d.day, d]))
  const weeks = buildCalendarGrid(year)

  // Compute month label positions
  const monthLabels = new Map<number, number>() // weekIndex -> month
  weeks.forEach((week, wi) => {
    const firstDay = week[0]
    if (firstDay.getFullYear() === year) {
      const m = firstDay.getMonth()
      if (!monthLabels.has(m)) monthLabels.set(wi, m)
    }
  })
  // Invert so we can lookup by weekIndex
  const weekIndexToMonth = new Map([...monthLabels.entries()].map(([wi, m]) => [wi, m]))

  // Stats
  const winDays  = heatmapData.filter((d) => d.net > 0).length
  const lossDays = heatmapData.filter((d) => d.net < 0).length
  const totalNet = heatmapData.reduce((sum, d) => sum + d.net, 0)
  const totalSessions = heatmapData.reduce((sum, d) => sum + d.sessions, 0)
  const today = new Date()

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Heatmap</h1>
          <p className="text-zinc-400 text-sm mt-1">Daily P&amp;L across the year</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold w-12 text-center tabular-nums">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Sessions" value={String(totalSessions)} />
        <StatPill label="Win Days" value={String(winDays)} color="text-emerald-400" />
        <StatPill label="Loss Days" value={String(lossDays)} color="text-red-400" />
        <StatPill
          label="Net P&L"
          value={`${totalNet >= 0 ? '+' : ''}${formatSC(totalNet)} SC`}
          color={totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* Hovered day detail */}
      {hoveredDay && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Date</p>
            <p className="text-white font-semibold">
              {new Date(hoveredDay.day + 'T00:00:00').toLocaleDateString('en', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="h-10 w-px bg-zinc-800 hidden sm:block" />
          <div>
            <p className="text-xs text-zinc-500 mb-1">Net</p>
            <p className={cn('font-bold tabular-nums', hoveredDay.net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {hoveredDay.net >= 0 ? '+' : ''}
              {formatSC(hoveredDay.net)} SC
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Sessions</p>
            <p className="text-white font-semibold tabular-nums">{hoveredDay.sessions}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Wagered</p>
            <p className="text-zinc-300 tabular-nums">{formatSC(hoveredDay.wagered)} SC</p>
          </div>
        </div>
      )}

      {/* Calendar */}
      {isLoading ? (
        <div className="h-40 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {/* Weekday column labels */}
            <div className="flex flex-col gap-1 mr-2 mt-5">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn('h-3 flex items-center', i % 2 !== 0 ? 'opacity-0' : '')}
                >
                  <span className="text-[9px] text-zinc-600 w-6">{d}</span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {/* Month label row */}
                <div className="h-4 flex items-end pb-0.5">
                  {weekIndexToMonth.has(wi) && (
                    <span className="text-[9px] text-zinc-500 whitespace-nowrap leading-none">
                      {MONTHS[weekIndexToMonth.get(wi)!]}
                    </span>
                  )}
                </div>

                {/* Day cells */}
                {week.map((date, di) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const dayData = dayMap.get(dateStr)
                  const isCurrentYear = date.getFullYear() === year
                  const isFuture = date > today

                  return (
                    <div
                      key={di}
                      title={dayData ? `${dateStr}: ${dayData.net >= 0 ? '+' : ''}${formatSC(dayData.net)} SC` : dateStr}
                      className={cn(
                        'w-3 h-3 rounded-sm transition-colors cursor-pointer',
                        !isCurrentYear || isFuture ? 'opacity-0 pointer-events-none' : '',
                        getCellColor(dayData?.net),
                      )}
                      onMouseEnter={() => dayData && setHoveredDay(dayData)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800">
            <span className="text-xs text-zinc-600 mr-1">Less</span>
            <div className="w-3 h-3 rounded-sm bg-zinc-800" />
            <div className="w-3 h-3 rounded-sm bg-red-700/60" />
            <div className="w-3 h-3 rounded-sm bg-red-600/80" />
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs text-zinc-600 mx-1">|</span>
            <div className="w-3 h-3 rounded-sm bg-emerald-700/60" />
            <div className="w-3 h-3 rounded-sm bg-emerald-600/80" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-xs text-zinc-600 ml-1">More</span>
            <span className="ml-4 text-xs text-zinc-600">
              <span className="text-red-400">Red</span> = loss ·{' '}
              <span className="text-emerald-400">Green</span> = win
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Renders a compact stat pill showing a muted label and an emphasized value.
 *
 * @param label - The small, muted descriptor text for the stat
 * @param value - The emphasized stat value shown next to the label
 * @param color - Optional CSS class applied to the value text (defaults to `text-white`)
 * @returns A JSX element containing the styled stat pill
 */

function StatPill({
  label,
  value,
  color = 'text-white',
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', color)}>{value}</span>
    </div>
  )
}
