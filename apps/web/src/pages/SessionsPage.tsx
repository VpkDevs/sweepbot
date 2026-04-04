import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatSC, formatRTP, timeAgo } from '../lib/utils'

export function SessionsPage() {
  const [page, setPage] = useState(1)
  const [platformFilter, setPlatformFilter] = useState<string>('')

  const { data: userPlatformsData } = useQuery({
    queryKey: ['user', 'platforms'],
    queryFn: () => api.user.platforms(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', { page, platformFilter }],
    queryFn: () =>
      api.sessions.list({
        page: String(page),
        pageSize: '25',
        ...(platformFilter ? { platformId: platformFilter } : {}),
      }),
    placeholderData: (prev) => prev,
  })

  const sessions = (data as { data?: Record<string, unknown>[] })?.data ?? []
  const meta = (data as { meta?: { total: number; hasMore: boolean; page: number } })?.meta
  const userPlatforms = (userPlatformsData as { data?: Record<string, unknown>[] })?.data ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Your complete play history across all platforms.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-zinc-500">
          <Filter className="h-4 w-4" />
          <span className="text-sm">Filter by:</span>
        </div>
        <select
          aria-label="Filter sessions by platform"
          value={platformFilter}
          onChange={(e) => {
            setPlatformFilter(e.target.value)
            setPage(1)
          }}
          className="focus:ring-brand-500 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-2"
        >
          <option value="">All Platforms</option>
          {userPlatforms.map((p) => (
            <option key={p['platform_id'] as string} value={p['platform_id'] as string}>
              {p['platform_name'] as string}
            </option>
          ))}
        </select>
        {meta && <span className="ml-auto text-xs text-zinc-600">{meta.total} total sessions</span>}
      </div>

      {/* Sessions list */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-500">
            <History className="h-8 w-8" />
            <p className="text-sm">No sessions recorded yet</p>
            <p className="text-xs text-zinc-600">Install the browser extension to start tracking</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {sessions.map((session) => {
              const wagered = (session['total_wagered'] as number) ?? 0
              const won = (session['total_won'] as number) ?? 0
              const net = won - wagered
              const rtp = session['rtp'] as number | null
              const rtpFmt = rtp ? formatRTP(rtp) : null
              const isOpen = !session['ended_at']
              const duration =
                session['ended_at'] && session['started_at']
                  ? Math.round(
                      (new Date(session['ended_at'] as string).getTime() -
                        new Date(session['started_at'] as string).getTime()) /
                        60000
                    )
                  : null

              return (
                <div
                  key={session['id'] as string}
                  className="group flex cursor-default items-center gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/40"
                >
                  {/* Platform logo */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800">
                    {session['platform_logo_url'] ? (
                      <img
                        src={session['platform_logo_url'] as string}
                        alt={`${session['platform_name']} logo`}
                        className="h-8 w-8 rounded-md"
                      />
                    ) : (
                      <span className="text-xs text-zinc-600">
                        {(session['platform_name'] as string)?.[0] ?? '?'}
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {session['platform_name'] as string}
                      </span>
                      {isOpen && (
                        <span className="flex items-center gap-1 rounded-full border border-green-800 bg-green-900/40 px-1.5 py-0.5 text-xs text-green-400">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                          Live
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        {timeAgo(session['started_at'] as string)}
                      </span>
                      {duration !== null && (
                        <span className="text-xs text-zinc-600">{duration}m</span>
                      )}
                      {!!session['game_name'] && (
                        <span className="truncate text-xs text-zinc-600">
                          {session['game_name'] as string}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden items-center gap-6 text-right sm:flex">
                    <div>
                      <p className="text-xs text-zinc-500">Wagered</p>
                      <p className="text-sm tabular-nums text-zinc-300">{formatSC(wagered)} SC</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Net</p>
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          net > 0 ? 'text-win' : net < 0 ? 'text-loss' : 'text-zinc-400'
                        )}
                      >
                        {net >= 0 ? '+' : ''}
                        {formatSC(net)} SC
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">RTP</p>
                      <p
                        className={cn('text-sm tabular-nums', rtpFmt?.className ?? 'text-zinc-600')}
                      >
                        {rtpFmt?.text ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Bets</p>
                      <p className="text-sm tabular-nums text-zinc-300">
                        {((session['total_bets'] as number) ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Net indicator (mobile) */}
                  <div className="sm:hidden">
                    {net > 0 ? (
                      <TrendingUp className="text-win h-5 w-5" />
                    ) : net < 0 ? (
                      <TrendingDown className="text-loss h-5 w-5" />
                    ) : (
                      <Minus className="h-5 w-5 text-zinc-600" />
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-400" />
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.total > 25 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
            <p className="text-xs text-zinc-500">
              Page {meta.page} — {meta.total} total sessions
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!meta.hasMore}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
