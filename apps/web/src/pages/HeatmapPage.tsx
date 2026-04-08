import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
  if (net > 500) return 'bg-emerald-500 shadow-sm shadow-emerald-500/30'
  if (net > 100) return 'bg-emerald-500/70'
  if (net > 0) return 'bg-emerald-600/40'
  if (net < -500) return 'bg-red-500 shadow-sm shadow-red-500/30'
  if (net < -100) return 'bg-red-500/70'
  if (net < 0) return 'bg-red-600/40'
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

  while (cursor.getFullYear() <= year) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
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

  const winDays = heatmapData.filter((d) => d.net > 0).length
  const lossDays = heatmapData.filter((d) => d.net < 0).length
  const totalNet = heatmapData.reduce((sum, d) => sum + d.net, 0)
  const totalSessions = heatmapData.reduce((sum, d) => sum + d.sessions, 0)
  const today = new Date()

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <div>
            <TextReveal as="h1" className="heading-display text-shimmer text-white" stagger={50}>
              Activity Heatmap
            </TextReveal>
            <p className="mt-1.5 text-sm text-zinc-500">Daily P&amp;L across the year</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="glass-card press-scale rounded-xl p-2 text-zinc-400 transition-all hover:bg-white/[0.06]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-14 text-center text-lg font-bold tabular-nums text-white">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= currentYear}
              className="glass-card press-scale rounded-xl p-2 text-zinc-400 transition-all hover:bg-white/[0.06] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
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
        <div className="glass-card-elevated animate-spring-in flex flex-wrap items-center gap-6 rounded-2xl p-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              Date
            </p>
            <p className="text-sm font-bold text-white">
              {new Date(hoveredDay.day + 'T00:00:00').toLocaleDateString('en', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="hidden h-10 w-px bg-white/[0.06] sm:block" />
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              Net
            </p>
            <p
              className={cn(
                'font-bold tabular-nums',
                hoveredDay.net >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {hoveredDay.net >= 0 ? '+' : ''}
              {formatSC(hoveredDay.net)} SC
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              Sessions
            </p>
            <p className="font-bold tabular-nums text-white">{hoveredDay.sessions}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              Wagered
            </p>
            <p className="font-medium tabular-nums text-zinc-300">
              {formatSC(hoveredDay.wagered)} SC
            </p>
          </div>
        </div>
      )}

      {/* Win/Loss Heatmap by Time */}
      <ScrollReveal delay={100}>
        <WinLossHeatmap />
      </ScrollReveal>

      {/* Calendar */}
      {isLoading ? (
        <div className="glass-card shimmer h-52 rounded-2xl" />
      ) : (
        <ScrollReveal delay={120}>
          <div className="glass-card overflow-x-auto rounded-2xl p-5">
            <div className="flex min-w-max gap-[3px]">
              {/* Weekday column labels */}
              <div className="mr-2 mt-5 flex flex-col gap-[3px]">
                {WEEKDAYS.map((d, i) => (
                  <div
                    key={d}
                    className={cn('flex h-[13px] items-center', i % 2 !== 0 ? 'opacity-0' : '')}
                  >
                    <span className="w-6 text-[9px] font-medium text-zinc-600">{d}</span>
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  <div className="flex h-4 items-end pb-0.5">
                    {weekIndexToMonth.has(wi) && (
                      <span className="whitespace-nowrap text-[9px] font-medium leading-none text-zinc-500">
                        {MONTHS[weekIndexToMonth.get(wi) ?? 0]}
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
                        title={
                          dayData
                            ? `${dateStr}: ${dayData.net >= 0 ? '+' : ''}${formatSC(dayData.net)} SC`
                            : dateStr
                        }
                        className={cn(
                          'h-[13px] w-[13px] cursor-pointer rounded-[3px] transition-all',
                          !isCurrentYear || isFuture ? 'pointer-events-none opacity-0' : '',
                          getCellColor(dayData?.net),
                          dayData && 'hover:z-10 hover:scale-150 hover:ring-2 hover:ring-white/30'
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
            <div className="mt-5 flex items-center gap-2 border-t border-white/[0.04] pt-4">
              <span className="mr-1 text-[10px] font-medium text-zinc-600">Less</span>
              <div className="h-[13px] w-[13px] rounded-[3px] bg-zinc-800/40" />
              <div className="h-[13px] w-[13px] rounded-[3px] bg-red-600/40" />
              <div className="h-[13px] w-[13px] rounded-[3px] bg-red-500/70" />
              <div className="h-[13px] w-[13px] rounded-[3px] bg-red-500" />
              <span className="mx-1 text-[10px] text-zinc-700">|</span>
              <div className="h-[13px] w-[13px] rounded-[3px] bg-emerald-600/40" />
              <div className="h-[13px] w-[13px] rounded-[3px] bg-emerald-500/70" />
              <div className="h-[13px] w-[13px] rounded-[3px] bg-emerald-500" />
              <span className="ml-1 text-[10px] font-medium text-zinc-600">More</span>
              <span className="ml-4 text-[10px] font-medium text-zinc-600">
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
    <div className="glass-card shine-on-hover flex items-center gap-2.5 rounded-xl px-4 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </span>
      <span className={cn('text-sm font-bold tabular-nums', color)}>{value}</span>
    </div>
  )
}
