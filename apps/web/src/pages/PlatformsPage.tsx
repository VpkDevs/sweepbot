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
import type { Platform, PlatformStatus } from '@sweepbot/types'

type SortKey = 'name' | 'trust_score' | 'created_at'
type SortDir = 'asc' | 'desc'

export function PlatformsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PlatformStatus | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortKey>('trust_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['platforms', { search, status, sortBy, sortDir, page }],
    queryFn: () =>
      api.platforms.list({
        sortBy,
        sortDir,
        page: String(page),
        pageSize: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
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
    if (sortBy !== col) return <ChevronUp className="h-3 w-3 opacity-20" />
    return sortDir === 'asc' ? (
      <ChevronUp className="text-brand-400 h-3 w-3" />
    ) : (
      <ChevronDown className="text-brand-400 h-3 w-3" />
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Platforms</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {meta?.total ?? '—'} sweepstakes platforms tracked. Ranked by Trust Index.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-brand-600 hover:bg-brand-500 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Platform
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search platforms…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="focus:ring-brand-500 w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              type="button"
              title="Clear platform search"
              aria-label="Clear platform search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'inactive', 'watchlist', 'suspended', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s === 'all' ? undefined : s)
                setPage(1)
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                (s === 'all' ? !status : status === s)
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : platforms.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-zinc-500">
            <Gamepad2 className="h-8 w-8" />
            <p className="text-sm">No platforms found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-5 py-3 text-left font-medium text-zinc-500">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 transition-colors hover:text-zinc-300"
                    >
                      Platform <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-center font-medium text-zinc-500">Status</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">
                    <button
                      onClick={() => toggleSort('trust_score')}
                      className="ml-auto flex items-center gap-1 transition-colors hover:text-zinc-300"
                    >
                      Trust Index <SortIcon col="trust_score" />
                    </button>
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">Redemption</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">Bonus</th>
                  <th className="px-5 py-3 text-right font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((platform) => {
                  const score = (platform as Record<string, unknown>)['trust_score'] as
                    | number
                    | null
                  const isConnected = connectedIds.has(platform.id)
                  return (
                    <tr
                      key={platform.id}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {platform.logoUrl ? (
                            <img
                              src={platform.logoUrl}
                              alt={`${platform.name} logo`}
                              className="h-7 w-7 rounded-md"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800">
                              <Gamepad2 className="h-3.5 w-3.5 text-zinc-600" />
                            </div>
                          )}
                          <div>
                            <Link
                              to="/platforms/$platformId"
                              params={{ platformId: platform.id }}
                              className="hover:text-brand-300 font-medium text-white transition-colors"
                            >
                              {platform.name}
                            </Link>
                            {platform.foundedYear && (
                              <p className="text-xs text-zinc-600">Est. {platform.foundedYear}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            platform.status === 'active'
                              ? 'border border-green-800 bg-green-900/40 text-green-400'
                              : 'border border-zinc-700 bg-zinc-800 text-zinc-500'
                          )}
                        >
                          {platform.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {score !== null && score !== undefined ? (
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={cn(
                                'text-sm font-bold tabular-nums',
                                trustScoreColor(score)
                              )}
                            >
                              {score.toFixed(0)}
                            </span>
                            <span className={cn('text-xs font-medium', trustScoreColor(score))}>
                              {trustScoreLabel(score)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(platform as Record<string, unknown>)['redemption_speed_score'] !==
                        undefined ? (
                          <span
                            className={cn(
                              'text-sm tabular-nums',
                              trustScoreColor(
                                ((platform as Record<string, unknown>)[
                                  'redemption_speed_score'
                                ] as number) ?? 0
                              )
                            )}
                          >
                            {(
                              (platform as Record<string, unknown>)[
                                'redemption_speed_score'
                              ] as number
                            )?.toFixed(0) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(platform as Record<string, unknown>)['bonus_generosity_score'] !==
                        undefined ? (
                          <span
                            className={cn(
                              'text-sm tabular-nums',
                              trustScoreColor(
                                ((platform as Record<string, unknown>)[
                                  'bonus_generosity_score'
                                ] as number) ?? 0
                              )
                            )}
                          >
                            {(
                              (platform as Record<string, unknown>)[
                                'bonus_generosity_score'
                              ] as number
                            )?.toFixed(0) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <Shield className="h-3 w-3" />
                              Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="text-brand-400 hover:text-brand-300 text-xs transition-colors"
                            >
                              + Connect
                            </button>
                          )}
                          <a
                            href={platform.affiliateUrl ?? platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 transition-colors hover:text-zinc-300"
                            title="Visit platform"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
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
        {meta && meta.total > 20 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
            <p className="text-xs text-zinc-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, meta.total)} of {meta.total}
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
      api.user.addPlatform({ platformId, username }),
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
        className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Connect a Platform</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close modal"
            aria-label="Close modal"
            className="text-zinc-500 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Platform</label>
            <select
              aria-label="Platform"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
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
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Your username on this platform
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username123"
              className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => addMutation.mutate({ platformId: selectedId, username })}
            disabled={!selectedId || !username || addMutation.isPending}
            className="bg-brand-600 hover:bg-brand-500 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
