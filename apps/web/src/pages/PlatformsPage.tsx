import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Search,
  Plus,
  Shield,
  ExternalLink,
  Gamepad2,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, trustScoreColor, trustScoreLabel } from '../lib/utils'
import type { Platform } from '@sweepbot/types'

type SortKey = 'name' | 'trust_score' | 'created_at'
type SortDir = 'asc' | 'desc'

export function PlatformsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'watchlist' | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortKey>('trust_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['platforms', { search, status, sortBy, sortDir, page }],
    queryFn: () =>
      api.platforms.list({ search: search || undefined, status, sortBy, sortDir, page, pageSize: 20 }),
    placeholderData: (prev) => prev,
  })

  const { data: userPlatforms } = useQuery({
    queryKey: ['user', 'platforms'],
    queryFn: () => api.user.platforms(),
  })

  const connectedIds = new Set(
    ((userPlatforms as { data?: { platform_id: string }[] })?.data ?? []).map(
      (p: { platform_id: string }) => p.platform_id
    )
  )

  const platforms = (data as { data?: Platform[] })?.data ?? []
  const meta = (data as { meta?: { total: number; hasMore: boolean } })?.meta

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortBy !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-brand-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-brand-400" />
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platforms</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {meta?.total ?? '—'} sweepstakes platforms tracked. Ranked by Trust Index.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Platform
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search platforms…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'watchlist', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s === 'all' ? undefined : s); setPage(1) }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize',
                (s === 'all' ? !status : status === s)
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : platforms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
            <Gamepad2 className="w-8 h-8" />
            <p className="text-sm">No platforms found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                    >
                      Platform <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="text-center px-5 py-3 text-zinc-500 font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">
                    <button
                      onClick={() => toggleSort('trust_score')}
                      className="flex items-center gap-1 ml-auto hover:text-zinc-300 transition-colors"
                    >
                      Trust Index <SortIcon col="trust_score" />
                    </button>
                  </th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Redemption</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Bonus</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((platform) => {
                  const score = (platform as Record<string, unknown>)['trust_score'] as number | null
                  const isConnected = connectedIds.has(platform.id)
                  return (
                    <tr
                      key={platform.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {platform.logo_url ? (
                            <img src={platform.logo_url} alt={`${platform.name} logo`} className="w-7 h-7 rounded-md" />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center">
                              <Gamepad2 className="w-3.5 h-3.5 text-zinc-600" />
                            </div>
                          )}
                          <div>
                            <Link
                              to="/platforms/$id"
                              params={{ id: platform.id }}
                              className="text-white font-medium hover:text-brand-300 transition-colors"
                            >
                              {platform.name}
                            </Link>
                            {platform.founded_year && (
                              <p className="text-xs text-zinc-600">Est. {platform.founded_year}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            platform.status === 'active'
                              ? 'bg-green-900/40 text-green-400 border border-green-800'
                              : platform.status === 'watchlist'
                                ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                          )}
                        >
                          {platform.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {score !== null && score !== undefined ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className={cn('text-sm font-bold tabular-nums', trustScoreColor(score))}>
                              {score.toFixed(0)}
                            </span>
                            <span
                              className={cn(
                                'text-xs font-medium',
                                trustScoreColor(score)
                              )}
                            >
                              {trustScoreLabel(score)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(platform as Record<string, unknown>)['redemption_speed_score'] !== undefined ? (
                          <span className={cn('text-sm tabular-nums', trustScoreColor(((platform as Record<string, unknown>)['redemption_speed_score'] as number) ?? 0))}>
                            {((platform as Record<string, unknown>)['redemption_speed_score'] as number)?.toFixed(0) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(platform as Record<string, unknown>)['bonus_generosity_score'] !== undefined ? (
                          <span className={cn('text-sm tabular-nums', trustScoreColor(((platform as Record<string, unknown>)['bonus_generosity_score'] as number) ?? 0))}>
                            {((platform as Record<string, unknown>)['bonus_generosity_score'] as number)?.toFixed(0) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <Shield className="w-3 h-3" />
                              Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                            >
                              + Connect
                            </button>
                          )}
                          <a
                            href={platform.affiliate_url ?? platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="Visit platform"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && (meta.total > 20) && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of {meta.total}
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

      {/* Add Platform Modal */}
      {showAddModal && (
        <AddPlatformModal
          platforms={platforms}
          connectedIds={connectedIds}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            void qc.invalidateQueries({ queryKey: ['user', 'platforms'] })
          }}
        />
      )}
    </div>
  )
}

// ── Add Platform Modal ──────────────────────────────────────────────────────

function AddPlatformModal({
  platforms,
  connectedIds,
  onClose,
  onSuccess,
}: {
  platforms: Platform[]
  connectedIds: Set<string>
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: ({ platformId, username }: { platformId: string; username: string }) =>
      api.user.addPlatform(platformId, username),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  })

  const available = platforms.filter((p) => !connectedIds.has(p.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Connect a Platform</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Platform</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a platform…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Your username on this platform
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username123"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => addMutation.mutate({ platformId: selectedId, username })}
            disabled={!selectedId || !username || addMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
