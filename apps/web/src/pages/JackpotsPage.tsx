import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Zap,
  TrendingUp,
  Clock,
  ExternalLink,
  Wifi,
  WifiOff,
  Filter,
  ChevronDown,
  Trophy,
  AlertCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatSC, CHART_TOOLTIP_STYLE } from '../lib/utils'

// ─── WebSocket live feed ───────────────────────────────────────────────────────

type JackpotSnapshot = {
  jackpot_id: string
  platform_id: string
  platform_name: string
  game_name: string
  current_amount: number
  previous_amount: number
  growth_rate_per_hour: number
  estimated_hit_in_hours: number | null
  historical_avg: number
  historical_high: number
  last_updated: string
  tier: 'mega' | 'major' | 'minor' | 'mini'
  currency: 'SC' | 'GC'
}

type LiveEvent = {
  type: 'snapshot' | 'hit' | 'surge'
  jackpot_id: string
  amount?: number
  platform_name?: string
  game_name?: string
  hit_amount?: number
  ts: string
}

function widthClass(percent: number) {
  const rounded = Math.max(0, Math.min(100, Math.round(percent / 5) * 5))
  return `score-width-${rounded}`
}

function useLiveJackpots() {
  const [liveData, setLiveData] = useState<Map<string, JackpotSnapshot>>(new Map())
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_WS_URL ?? 'ws://localhost:3001/ws/jackpots'

    function connect() {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => setConnected(true)
        ws.onclose = () => {
          setConnected(false)
          // Reconnect after 5s
          setTimeout(connect, 5000)
        }
        ws.onerror = () => ws.close()

        ws.onmessage = (e: MessageEvent<string>) => {
          try {
            const msg = JSON.parse(e.data) as { type: string; data: unknown }
            if (msg.type === 'snapshot') {
              const snap = msg.data as JackpotSnapshot
              setLiveData((prev) => new Map(prev).set(snap.jackpot_id, snap))
            } else if (msg.type === 'hit' || msg.type === 'surge') {
              const ev = msg.data as LiveEvent
              setEvents((prev) => [ev, ...prev].slice(0, 50))
            }
          } catch {
            // ignore parse errors
          }
        }
      } catch {
        // WebSocket not available (dev without API), reconnect later
        setTimeout(connect, 10000)
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { liveData, events, connected }
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  mega: { label: 'MEGA', className: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  major: { label: 'MAJOR', className: 'bg-purple-900/60 text-purple-300 border-purple-700' },
  minor: { label: 'MINOR', className: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  mini: { label: 'MINI', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
} as const

function TierBadge({ tier }: { tier: keyof typeof TIER_CONFIG }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <span
      className={cn(
        'rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}

// ─── Growth indicator ─────────────────────────────────────────────────────────

function GrowthRate({ rate }: { rate: number }) {
  if (rate === 0) return <span className="text-xs text-zinc-500">—</span>
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        rate > 0 ? 'text-green-400' : 'text-red-400'
      )}
    >
      <TrendingUp className={cn('h-3 w-3', rate < 0 && 'rotate-180')} />
      {formatSC(Math.abs(rate))}/hr
    </span>
  )
}

// ─── Jackpot card ─────────────────────────────────────────────────────────────

function JackpotCard({
  jackpot,
  live,
  onSelect,
  selected,
}: {
  jackpot: Record<string, unknown>
  live: JackpotSnapshot | undefined
  onSelect: () => void
  selected: boolean
}) {
  const current = live?.current_amount ?? (jackpot['current_amount'] as number)
  const prevAmount = live?.previous_amount ?? (jackpot['current_amount'] as number)
  const delta = current - prevAmount
  const tier = (live?.tier ?? jackpot['tier']) as keyof typeof TIER_CONFIG
  const growthRate = live?.growth_rate_per_hour ?? (jackpot['growth_rate_per_hour'] as number) ?? 0
  const historicalHigh = (jackpot['historical_high'] as number) ?? 0
  const pctOfHigh = historicalHigh > 0 ? Math.min(100, (current / historicalHigh) * 100) : 0
  const estHours =
    live?.estimated_hit_in_hours ?? (jackpot['estimated_hit_in_hours'] as number | null)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border bg-zinc-900 p-4 text-left transition-all hover:border-zinc-600',
        selected ? 'border-brand-500 ring-brand-500/30 ring-1' : 'border-zinc-800'
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-white">
            {jackpot['game_name'] as string}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{jackpot['platform_name'] as string}</p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Amount */}
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-jackpot text-2xl font-black tabular-nums">{formatSC(current)}</span>
        <span className="text-xs text-zinc-500">{jackpot['currency'] as string}</span>
        {delta !== 0 && (
          <span
            className={cn(
              'ml-1 text-xs font-medium',
              delta > 0 ? 'text-green-400' : 'text-red-400'
            )}
          >
            {delta > 0 ? '+' : ''}
            {formatSC(delta)}
          </span>
        )}
      </div>

      {/* Progress bar vs historical high */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>vs all-time high</span>
          <span>{pctOfHigh.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              widthClass(pctOfHigh),
              pctOfHigh >= 90 ? 'bg-amber-400' : pctOfHigh >= 70 ? 'bg-brand-500' : 'bg-zinc-600'
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <GrowthRate rate={growthRate} />
        {estHours != null && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <span>
              ~{estHours < 1 ? `${Math.round(estHours * 60)}m` : `${estHours.toFixed(0)}h`}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Event feed ───────────────────────────────────────────────────────────────

function EventFeed({ events }: { events: LiveEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-zinc-600">
        Waiting for live events…
      </div>
    )
  }

  return (
    <div className="max-h-60 space-y-1 overflow-y-auto">
      {events.map((ev, i) => (
        <div
          key={`${ev.jackpot_id}-${ev.ts}-${i}`}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            ev.type === 'hit' ? 'border border-amber-800/50 bg-amber-900/20' : 'bg-zinc-900'
          )}
        >
          {ev.type === 'hit' ? (
            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-green-400" />
          )}
          <span className="flex-1 text-zinc-300">
            {ev.type === 'hit' ? (
              <>
                <span className="font-semibold text-amber-300">{ev.game_name}</span> on{' '}
                <span className="text-white">{ev.platform_name}</span> hit for{' '}
                <span className="font-semibold text-amber-300">
                  {formatSC(ev.hit_amount ?? 0)} SC
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-green-300">{ev.game_name}</span> surging fast —{' '}
                <span className="text-white">{formatSC(ev.amount ?? 0)} SC</span>
              </>
            )}
          </span>
          <span className="shrink-0 text-zinc-600">
            {new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── History chart ────────────────────────────────────────────────────────────

function JackpotHistoryChart({ jackpotId }: { jackpotId: string }) {
  const { data } = useQuery({
    queryKey: ['jackpot', 'history', jackpotId],
    queryFn: () => api.jackpots.history(jackpotId),
    staleTime: 60_000,
    enabled: !!jackpotId,
  })

  const history = (data as { data?: Record<string, unknown>[] })?.data ?? []

  if (history.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No history data yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={history as Record<string, number>[]}>
        <defs>
          <linearGradient id="jackpotGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="recorded_at"
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })
          }
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(v: number) => [`${formatSC(v)} SC`, 'Amount']}
          labelFormatter={(l: string) => new Date(l).toLocaleString()}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#jackpotGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TierFilter = 'all' | 'mega' | 'major' | 'minor' | 'mini'

export function JackpotsPage() {
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { liveData, events, connected } = useLiveJackpots()

  const { data: jackpotsData } = useQuery({
    queryKey: ['jackpots'],
    queryFn: () => api.jackpots.leaderboard(),
    staleTime: 30_000,
    refetchInterval: 60_000, // fallback polling even without WS
  })

  const { data: leaderboardData } = useQuery({
    queryKey: ['jackpots', 'leaderboard'],
    queryFn: () => api.jackpots.leaderboard(),
    staleTime: 60_000,
  })

  const jackpots = (jackpotsData as { data?: Record<string, unknown>[] })?.data ?? []
  const leaderboard = (leaderboardData as { data?: Record<string, unknown>[] })?.data ?? []

  // Merge live WS data into static query data
  const merged = jackpots.map((j) => ({
    ...j,
    ...(liveData.get(j['jackpot_id'] as string) ?? {}),
  }))

  // Filter
  const filtered = merged.filter((j) => {
    if (tierFilter !== 'all' && j['tier'] !== tierFilter) return false
    if (platformFilter !== 'all' && j['platform_id'] !== platformFilter) return false
    return true
  })

  // Sort by current amount desc
  const sorted = [...filtered].sort(
    (a, b) => (b['current_amount'] as number) - (a['current_amount'] as number)
  )

  // Unique platforms for filter
  const platforms = Array.from(
    new Map(jackpots.map((j) => [j['platform_id'], j['platform_name']])).entries()
  )

  const selectedJackpot = selectedId ? jackpots.find((j) => j['jackpot_id'] === selectedId) : null

  // Track total value across all jackpots
  const totalValue = merged.reduce((sum, j) => sum + ((j['current_amount'] as number) ?? 0), 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jackpot Intelligence</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time progressive jackpot tracking across all platforms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
              connected
                ? 'border border-green-800 bg-green-900/30 text-green-400'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-500'
            )}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? 'Live' : 'Polling'}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total Pool Value</p>
          <p className="text-jackpot mt-1 text-2xl font-black tabular-nums">
            {formatSC(totalValue)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">SC across {merged.length} jackpots</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Surging Now</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-green-400">
            {merged.filter((j) => (j['growth_rate_per_hour'] as number) > 100).length}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">growing &gt;100 SC/hr</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Mega Jackpots</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-amber-400">
            {merged.filter((j) => j['tier'] === 'mega').length}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">tracked live</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Hits Today</p>
          <p className="text-brand-400 mt-1 text-2xl font-black tabular-nums">
            {events.filter((e) => e.type === 'hit').length}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">in this session</p>
        </div>
      </div>

      {/* All-time leaderboard banner */}
      {leaderboard.length > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-950/40 to-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-300">All-Time Jackpot Leaders</h2>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-1">
            {leaderboard.slice(0, 5).map((j, i) => (
              <div key={j['jackpot_id'] as string} className="flex shrink-0 items-center gap-3">
                <span className="text-2xl font-black text-amber-800/60">#{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {formatSC(j['max_amount'] as number)} SC
                  </p>
                  <p className="text-xs text-zinc-500">{j['game_name'] as string}</p>
                  <p className="text-[10px] text-zinc-600">{j['platform_name'] as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
        >
          <Filter className="h-3 w-3" />
          Filters
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')}
          />
        </button>
        {(['all', 'mega', 'major', 'minor', 'mini'] as TierFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
              tierFilter === t
                ? 'bg-brand-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <label className="mb-1.5 block text-xs text-zinc-400">Platform</label>
          <select
            aria-label="Filter jackpots by platform"
            title="Filter jackpots by platform"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="focus:ring-brand-500 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
          >
            <option value="all">All Platforms</option>
            {platforms.map(([id, name]) => (
              <option key={id as string} value={id as string}>
                {name as string}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Jackpot grid */}
        <div className="space-y-4 lg:col-span-2">
          {sorted.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">No jackpots match your filters.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sorted.map((j) => (
                <JackpotCard
                  key={j['jackpot_id'] as string}
                  jackpot={j}
                  live={liveData.get(j['jackpot_id'] as string)}
                  selected={selectedId === j['jackpot_id']}
                  onSelect={() =>
                    setSelectedId((prev) =>
                      prev === (j['jackpot_id'] as string) ? null : (j['jackpot_id'] as string)
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: event feed + selected detail */}
        <div className="space-y-4">
          {/* Selected jackpot detail */}
          {selectedJackpot && (
            <div className="border-brand-500/30 space-y-3 rounded-xl border bg-zinc-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {selectedJackpot['game_name'] as string}
                </h3>
                <a
                  href={selectedJackpot['platform_url'] as string | undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open platform"
                  aria-label="Open platform"
                  className="hover:text-brand-400 text-zinc-500 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Historical Avg', formatSC(selectedJackpot['historical_avg'] as number) + ' SC'],
                  [
                    'Historical High',
                    formatSC(selectedJackpot['historical_high'] as number) + ' SC',
                  ],
                  [
                    'Avg Hit Interval',
                    selectedJackpot['avg_hit_interval_days'] != null
                      ? (selectedJackpot['avg_hit_interval_days'] as number).toFixed(1) + 'd'
                      : '—',
                  ],
                  ['Hit Count', String(selectedJackpot['hit_count'] ?? '—')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-zinc-800/60 p-2">
                    <p className="text-zinc-500">{label}</p>
                    <p className="mt-0.5 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs text-zinc-500">Growth History</p>
                <JackpotHistoryChart jackpotId={selectedJackpot['jackpot_id'] as string} />
              </div>
            </div>
          )}

          {/* Live event feed */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  connected ? 'animate-pulse bg-green-400' : 'bg-zinc-600'
                )}
              />
              <h3 className="text-sm font-semibold text-zinc-300">Live Events</h3>
            </div>
            <div className="p-3">
              <EventFeed events={events} />
            </div>
          </div>

          {/* Data moat promo box (free-tier upgrade prompt) */}
          <div className="from-brand-950/60 border-brand-800/40 rounded-xl border bg-gradient-to-br to-zinc-900 p-4">
            <div className="flex items-start gap-2">
              <Zap className="text-brand-400 mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-brand-300 text-xs font-semibold">
                  Every day of data widens the moat
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Upgrade to Pro for full jackpot history, probability curves, and must-hit-by
                  ceiling alerts.
                </p>
                <a
                  href="/pricing"
                  className="text-brand-400 hover:text-brand-300 mt-2 inline-block text-xs font-medium transition-colors"
                >
                  View plans →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
