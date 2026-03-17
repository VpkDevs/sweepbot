import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  DollarSign,
  Timer,
  TrendingDown,
  Filter,
  ChevronDown,
  Loader2,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatSC } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type RedemptionStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'all'

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'text-yellow-400 bg-yellow-900/30 border-yellow-800',
  },
  processing: {
    label: 'Processing',
    icon: Timer,
    className: 'text-blue-400 bg-blue-900/30 border-blue-800',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'text-green-400 bg-green-900/30 border-green-800',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'text-red-400 bg-red-900/30 border-red-800',
  },
} as const

const PAYMENT_METHODS = [
  'ACH',
  'PayPal',
  'Venmo',
  'Check',
  'Prepaid Visa',
  'Gift Card',
  'Bank Wire',
  'Skrill',
  'Other',
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cfg.className
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Processing time display ──────────────────────────────────────────────────

function ProcessingTime({ days }: { days: number | null }) {
  if (days === null) return <span className="text-zinc-500">—</span>
  const color = days <= 3 ? 'text-green-400' : days <= 7 ? 'text-yellow-400' : 'text-red-400'
  return <span className={cn('font-medium tabular-nums', color)}>{days}d</span>
}

// ─── Log Redemption Modal ─────────────────────────────────────────────────────

function LogRedemptionModal({
  open,
  onClose,
  platforms,
}: {
  open: boolean
  onClose: () => void
  platforms: Record<string, unknown>[]
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    platform_id: '',
    amount_sc: '',
    payment_method: '',
    requested_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.redemptions.create({
        platform_id: form.platform_id,
        amount_sc: parseFloat(form.amount_sc),
        payment_method: form.payment_method,
        requested_at: form.requested_at,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['redemptions'] })
      void qc.invalidateQueries({ queryKey: ['redemptions', 'stats'] })
      onClose()
      setForm({
        platform_id: '',
        amount_sc: '',
        payment_method: '',
        requested_at: new Date().toISOString().split('T')[0],
        notes: '',
      })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to log redemption.')
    },
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">Log Redemption</h2>
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

        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Platform *</label>
            <select
              aria-label="Redemption platform"
              title="Redemption platform"
              value={form.platform_id}
              onChange={(e) => setForm({ ...form, platform_id: e.target.value })}
              required
              className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
            >
              <option value="">Select platform…</option>
              {platforms.map((p) => (
                <option key={p['platform_id'] as string} value={p['platform_id'] as string}>
                  {p['platform_name'] as string}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Amount (SC) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                aria-label="Redemption amount in SC"
                title="Redemption amount in SC"
                value={form.amount_sc}
                onChange={(e) => setForm({ ...form, amount_sc: e.target.value })}
                placeholder="50.00"
                className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Requested Date *
              </label>
              <input
                type="date"
                aria-label="Requested date"
                title="Requested date"
                value={form.requested_at}
                onChange={(e) => setForm({ ...form, requested_at: e.target.value })}
                className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Payment Method *
            </label>
            <select
              aria-label="Redemption payment method"
              title="Redemption payment method"
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              required
              className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
            >
              <option value="">Select method…</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any relevant details…"
              className="focus:ring-brand-500 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || !form.platform_id || !form.amount_sc || !form.payment_method
            }
            className="bg-brand-600 hover:bg-brand-500 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Log Redemption
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Mark Complete Modal ──────────────────────────────────────────────────────

function MarkCompleteModal({
  redemption,
  onClose,
}: {
  redemption: Record<string, unknown> | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().split('T')[0])

  const mutation = useMutation({
    mutationFn: () =>
      api.redemptions.update(redemption!['redemption_id'] as string, {
        status: 'completed',
        completed_at: completedAt,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['redemptions'] })
      void qc.invalidateQueries({ queryKey: ['redemptions', 'stats'] })
      onClose()
    },
  })

  if (!redemption) return null

  const requestedDate = new Date(redemption['requested_at'] as string)
  const completedDate = new Date(completedAt)
  const processingDays = Math.round(
    (completedDate.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white">Mark as Completed</h2>
        <p className="text-sm text-zinc-400">
          Record when{' '}
          <span className="font-medium text-white">
            {formatSC(redemption['amount_sc'] as number)} SC
          </span>{' '}
          from{' '}
          <span className="font-medium text-white">{redemption['platform_name'] as string}</span>{' '}
          arrived.
        </p>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Completed Date</label>
          <input
            type="date"
            aria-label="Completed date"
            title="Completed date"
            value={completedAt}
            onChange={(e) => setCompletedAt(e.target.value)}
            className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
          />
        </div>

        {processingDays >= 0 && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              processingDays <= 3
                ? 'bg-green-900/20 text-green-400'
                : processingDays <= 7
                  ? 'bg-yellow-900/20 text-yellow-400'
                  : 'bg-red-900/20 text-red-400'
            )}
          >
            <Clock className="h-4 w-4 shrink-0" />
            Processing time: {processingDays} day{processingDays !== 1 ? 's' : ''}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Community Stats Panel ────────────────────────────────────────────────────

function CommunityStats({ communityData }: { communityData: Record<string, unknown>[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-300">Community Actual Processing Times</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Crowdsourced real-world data, not platform claims
        </p>
      </div>
      <div className="divide-y divide-zinc-800">
        {communityData.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-zinc-600">
            No community data yet.
          </div>
        ) : (
          communityData.map((row) => {
            const avgDays = row['avg_processing_days'] as number
            const rejRate = row['rejection_rate'] as number
            return (
              <div
                key={`${row['platform_id'] as string}-${row['payment_method'] as string}`}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm text-white">{row['platform_name'] as string}</p>
                  <p className="text-xs text-zinc-500">{row['payment_method'] as string}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Avg Time</p>
                    <ProcessingTime days={avgDays} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Reject %</p>
                    <p
                      className={cn(
                        'text-sm font-medium tabular-nums',
                        rejRate < 2
                          ? 'text-green-400'
                          : rejRate < 10
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      )}
                    >
                      {rejRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Samples</p>
                    <p className="text-sm tabular-nums text-zinc-300">
                      {(row['sample_count'] as number).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RedemptionsPage() {
  const [statusFilter, setStatusFilter] = useState<RedemptionStatus>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [showLogModal, setShowLogModal] = useState(false)
  const [markCompleteTarget, setMarkCompleteTarget] = useState<Record<string, unknown> | null>(null)

  const { data: redemptionsData, isLoading } = useQuery({
    queryKey: ['redemptions', { status: statusFilter, platform: platformFilter, page }],
    queryFn: () =>
      api.redemptions.list({
        page: String(page),
        page_size: '20',
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(platformFilter !== 'all' ? { platform_id: platformFilter } : {}),
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const { data: statsData } = useQuery({
    queryKey: ['redemptions', 'stats'],
    queryFn: () => api.redemptions.stats(),
    staleTime: 60_000,
  })

  const { data: communityData } = useQuery({
    queryKey: ['redemptions', 'community'],
    queryFn: () => api.redemptions.communityBenchmarks(),
    staleTime: 300_000,
  })

  const { data: platformsData } = useQuery({
    queryKey: ['user', 'platforms'],
    queryFn: () => api.user.platforms(),
    staleTime: 300_000,
  })

  const redemptions = (redemptionsData as { data?: Record<string, unknown>[] })?.data ?? []
  const totalPages = (redemptionsData as { total_pages?: number })?.total_pages ?? 1
  const stats = statsData as Record<string, unknown> | undefined
  const community = (communityData as { data?: Record<string, unknown>[] })?.data ?? []
  const userPlatforms = (platformsData as { data?: Record<string, unknown>[] })?.data ?? []

  const platforms = Array.from(
    new Map(userPlatforms.map((p) => [p['platform_id'], p['platform_name']])).entries()
  )

  return (
    <>
      <LogRedemptionModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        platforms={userPlatforms}
      />
      <MarkCompleteModal
        redemption={markCompleteTarget}
        onClose={() => setMarkCompleteTarget(null)}
      />

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Redemption Tracker</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Log, track, and crowdsource real processing times across all platforms.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="bg-brand-600 hover:bg-brand-500 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Log Redemption
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Total Redeemed',
              value: stats ? `${formatSC(stats['total_amount_sc'] as number)} SC` : '—',
              sub: 'lifetime',
              icon: DollarSign,
              color: 'text-brand-400',
            },
            {
              label: 'Pending',
              value: stats ? String(stats['pending_count'] ?? 0) : '—',
              sub: 'awaiting payout',
              icon: Clock,
              color: 'text-yellow-400',
            },
            {
              label: 'Avg Processing',
              value: stats?.['avg_processing_days']
                ? `${(stats['avg_processing_days'] as number).toFixed(1)}d`
                : '—',
              sub: 'your actual time',
              icon: Timer,
              color: 'text-blue-400',
            },
            {
              label: 'Rejection Rate',
              value: stats?.['rejection_rate']
                ? `${(stats['rejection_rate'] as number).toFixed(1)}%`
                : '—',
              sub: 'your personal rate',
              icon: TrendingDown,
              color:
                stats && (stats['rejection_rate'] as number) > 5
                  ? 'text-red-400'
                  : 'text-green-400',
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div
              key={label}
              className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              </div>
              <p className={cn('text-3xl font-black tabular-nums', color)}>{value}</p>
              <p className="text-xs text-zinc-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
          >
            <Filter className="h-3 w-3" />
            Platform
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')}
            />
          </button>

          {(['all', 'pending', 'processing', 'completed', 'rejected'] as RedemptionStatus[]).map(
            (s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  setStatusFilter(s)
                  setPage(1)
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs capitalize transition-colors',
                  statusFilter === s
                    ? 'bg-brand-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                {s}
              </button>
            )
          )}
        </div>

        {showFilters && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <label className="mb-1.5 block text-xs text-zinc-400">Platform</label>
            <select
              aria-label="Filter redemptions by platform"
              title="Filter redemptions by platform"
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value)
                setPage(1)
              }}
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

        {/* Redemptions table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <AlertCircle className="h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">No redemptions found.</p>
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="text-brand-400 hover:text-brand-300 text-xs transition-colors"
              >
                Log your first redemption →
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-5 py-3 text-left font-medium text-zinc-500">Platform</th>
                      <th className="px-5 py-3 text-right font-medium text-zinc-500">Amount</th>
                      <th className="px-5 py-3 text-center font-medium text-zinc-500">Method</th>
                      <th className="px-5 py-3 text-center font-medium text-zinc-500">Status</th>
                      <th className="px-5 py-3 text-right font-medium text-zinc-500">Requested</th>
                      <th className="px-5 py-3 text-right font-medium text-zinc-500">Processing</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => {
                      const status = r['status'] as keyof typeof STATUS_CONFIG
                      const days = r['processing_days'] as number | null
                      return (
                        <tr
                          key={r['redemption_id'] as string}
                          className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/20"
                        >
                          <td className="px-5 py-3">
                            <p className="text-white">{r['platform_name'] as string}</p>
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums text-white">
                            {formatSC(r['amount_sc'] as number)} SC
                          </td>
                          <td className="px-5 py-3 text-center text-zinc-400">
                            {r['payment_method'] as string}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-zinc-400">
                            {new Date(r['requested_at'] as string).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <ProcessingTime days={days} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            {(status === 'pending' || status === 'processing') && (
                              <button
                                type="button"
                                onClick={() => setMarkCompleteTarget(r)}
                                className="text-brand-400 hover:text-brand-300 whitespace-nowrap text-xs transition-colors"
                              >
                                Mark done
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
                <p className="text-xs text-zinc-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Community stats */}
        <CommunityStats communityData={community} />

        {/* Tax center promo */}
        <div className="rounded-xl border border-zinc-700 bg-gradient-to-r from-zinc-900 to-zinc-900 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Tax Center</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Your total redemptions feed directly into the Tax Center for estimated liability,
                1099 reconciliation, and accountant-ready PDF exports.
              </p>
            </div>
            <a
              href="/settings?tab=tax"
              className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              View Tax Center →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
