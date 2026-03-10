import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { TextReveal } from '../components/fx/TextReveal'
import { WinLossHeatmap } from '../components/WinLossHeatmap'

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
  if (net === undefined) return 'bg-zinc-800/40'
  if (net > 500)  return 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
  if (net > 100)  return 'bg-emerald-500/70'
  if (net > 0)    return 'bg-emerald-600/40'
  if (net < -500) return 'bg-red-500 shadow-sm shadow-red-500/30'
  if (net < -100) return 'bg-red-500/70'
  if (net < 0)    return 'bg-red-600/40'
  return 'bg-zinc-600/50'
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
  start.setDate(start.getDate() - start.getDay())

  const weeks: Date[][] = []
  const cursor = new Date(start)

  while (true) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
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

  const monthLabels = new Map<number, number>()
  weeks.forEach((week, wi) => {
    const firstDay = week[0]
    if (firstDay?.getFullYear() === year) {
      const m = firstDay.getMonth()
      if (!monthLabels.has(m)) monthLabels.set(wi, m)
    }
  })
  const weekIndexToMonth = new Map([...monthLabels.entries()].map(([wi, m]) => [wi, m]))

  const winDays  = heatmapData.filter((d) => d.net > 0).length
  const lossDays = heatmapData.filter((d) => d.net < 0).length
  const totalNet = heatmapData.reduce((sum, d) => sum + d.net, 0)
  const totalSessions = heatmapData.reduce((sum, d) => sum + d.sessions, 0)
  const today = new Date()

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="heading-display text-white text-shimmer" stagger={50}>Activity Heatmap</TextReveal>
          <p className="text-zinc-500 text-sm mt-1.5">Daily P&amp;L across the year</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-2 rounded-xl glass-card hover:bg-white/[0.06] transition-all text-zinc-400 press-scale"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-bold w-14 text-center tabular-nums text-lg">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
            className="p-2 rounded-xl glass-card hover:bg-white/[0.06] transition-all text-zinc-400 disabled:opacity-30 press-scale"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      </ScrollReveal>

      {/* Stat pills */}
      <ScrollReveal delay={60}>
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
      </ScrollReveal>

      {/* Hovered day detail */}
      {hoveredDay && (
        <div className="glass-card-elevated rounded-2xl p-4 flex flex-wrap items-center gap-6 animate-spring-in">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-1">Date</p>
            <p className="text-white font-bold text-sm">
              {new Date(hoveredDay.day + 'T00:00:00').toLocaleDateString('en', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="h-10 w-px bg-white/[0.06] hidden sm:block" />
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-1">Net</p>
            <p className={cn('font-bold tabular-nums', hoveredDay.net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {hoveredDay.net >= 0 ? '+' : ''}
              {formatSC(hoveredDay.net)} SC
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-1">Sessions</p>
            <p className="text-white font-bold tabular-nums">{hoveredDay.sessions}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-1">Wagered</p>
            <p className="text-zinc-300 tabular-nums font-medium">{formatSC(hoveredDay.wagered)} SC</p>
          </div>
        </div>
      )}

      {/* Win/Loss Heatmap by Time */}
      <ScrollReveal delay={100}>
        <WinLossHeatmap />
      </ScrollReveal>

      {/* Calendar */}
      {isLoading ? (
        <div className="glass-card rounded-2xl h-52 shimmer" />
      ) : (
        <ScrollReveal delay={120}>
        <div className="glass-card rounded-2xl p-5 overflow-x-auto">
          <div className="flex gap-[3px] min-w-max">
            {/* Weekday column labels */}
            <div className="flex flex-col gap-[3px] mr-2 mt-5">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn('h-[13px] flex items-center', i % 2 !== 0 ? 'opacity-0' : '')}
                >
                  <span className="text-[9px] text-zinc-600 w-6 font-medium">{d}</span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                <div className="h-4 flex items-end pb-0.5">
                  {weekIndexToMonth.has(wi) && (
                    <span className="text-[9px] text-zinc-500 whitespace-nowrap leading-none font-medium">
                      {MONTHS[weekIndexToMonth.get(wi)!]}
                    </span>
                  )}
                </div>

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
                        'w-[13px] h-[13px] rounded-[3px] transition-all cursor-pointer',
                        !isCurrentYear || isFuture ? 'opacity-0 pointer-events-none' : '',
                        getCellColor(dayData?.net),
                        dayData && 'hover:ring-2 hover:ring-white/30 hover:scale-150 hover:z-10',
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
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.04]">
            <span className="text-[10px] text-zinc-600 mr-1 font-medium">Less</span>
            <div className="w-[13px] h-[13px] rounded-[3px] bg-zinc-800/40" />
            <div className="w-[13px] h-[13px] rounded-[3px] bg-red-600/40" />
            <div className="w-[13px] h-[13px] rounded-[3px] bg-red-500/70" />
            <div className="w-[13px] h-[13px] rounded-[3px] bg-red-500" />
            <span className="text-[10px] text-zinc-700 mx-1">|</span>
            <div className="w-[13px] h-[13px] rounded-[3px] bg-emerald-600/40" />
            <div className="w-[13px] h-[13px] rounded-[3px] bg-emerald-500/70" />
            <div className="w-[13px] h-[13px] rounded-[3px] bg-emerald-500" />
            <span className="text-[10px] text-zinc-600 ml-1 font-medium">More</span>
            <span className="ml-4 text-[10px] text-zinc-600 font-medium">
              <span className="text-red-400">Red</span> = loss ·{' '}
              <span className="text-emerald-400">Green</span> = win
            </span>
          </div>
        </div>
        </ScrollReveal>
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
    <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-2.5 shine-on-hover">
      <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', color)}>{value}</span>
    </div>
  )
}
