import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
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
        page,
        pageSize: 25,
        platformId: platformFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const sessions = (data as { data?: Record<string, unknown>[] })?.data ?? []
  const meta = (data as { meta?: { total: number; hasMore: boolean; page: number } })?.meta
  const userPlatforms = (userPlatformsData as { data?: Record<string, unknown>[] })?.data ?? []

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Your complete play history across all platforms.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-zinc-500">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filter by:</span>
        </div>
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Platforms</option>
          {userPlatforms.map((p) => (
            <option key={p['platform_id'] as string} value={p['platform_id'] as string}>
              {p['platform_name'] as string}
            </option>
          ))}
        </select>
        {meta && (
          <span className="text-xs text-zinc-600 ml-auto">{meta.total} total sessions</span>
        )}
      </div>

      {/* Sessions list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
            <History className="w-8 h-8" />
            <p className="text-sm">No sessions recorded yet</p>
            <p className="text-xs text-zinc-600">Install the browser extension to start tracking</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {sessions.map((session) => {
              const wagered = session['total_wagered'] as number ?? 0
              const won = session['total_won'] as number ?? 0
              const net = won - wagered
              const rtp = session['rtp'] as number | null
              const rtpFmt = rtp ? formatRTP(rtp) : null
              const isOpen = !session['ended_at']
              const duration = session['ended_at'] && session['started_at']
                ? Math.round(
                    (new Date(session['ended_at'] as string).getTime() -
                      new Date(session['started_at'] as string).getTime()) /
                      60000
                  )
                : null

              return (
                <Link
                  key={session['id'] as string}
                  to="/sessions/$id"
                  params={{ id: session['id'] as string }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/40 transition-colors group"
                >
                  {/* Platform logo */}
                  <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                    {session['platform_logo_url'] ? (
                      <img
                        src={session['platform_logo_url'] as string}
                        alt={`${session['platform_name']} logo`}
                        className="w-8 h-8 rounded-md"
                      />
                    ) : (
                      <span className="text-xs text-zinc-600">
                        {(session['platform_name'] as string)?.[0] ?? '?'}
                      </span>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {session['platform_name'] as string}
                      </span>
                      {isOpen && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-900/40 border border-green-800 text-green-400 text-xs rounded-full">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-zinc-500">
                        {timeAgo(session['started_at'] as string)}
                      </span>
                      {duration !== null && (
                        <span className="text-xs text-zinc-600">{duration}m</span>
                      )}
                      {session['game_name'] && (
                        <span className="text-xs text-zinc-600 truncate">
                          {session['game_name'] as string}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-right">
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
                      <p className={cn('text-sm tabular-nums', rtpFmt?.className ?? 'text-zinc-600')}>
                        {rtpFmt?.text ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Bets</p>
                      <p className="text-sm tabular-nums text-zinc-300">
                        {(session['total_bets'] as number ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Net indicator (mobile) */}
                  <div className="sm:hidden">
                    {net > 0 ? (
                      <TrendingUp className="w-5 h-5 text-win" />
                    ) : net < 0 ? (
                      <TrendingDown className="w-5 h-5 text-loss" />
                    ) : (
                      <Minus className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.total > 25 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              Page {meta.page} — {meta.total} total sessions
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!meta.hasMore}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
