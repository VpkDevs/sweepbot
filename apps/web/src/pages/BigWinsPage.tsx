import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Plus, CheckCircle, Clock, XCircle, Eye, EyeOff } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, timeAgo, cn } from '../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type BigWin = {
  id: string
  platform_name: string | null
  game_name: string | null
  win_amount_sc: number
  multiplier: number | null
  bet_amount: number | null
  screenshot_url: string | null
  verification_status: 'pending' | 'verified' | 'rejected' | 'auto_verified'
  verified_at: string | null
  is_public: boolean
  display_name: string | null
  occurred_at: string
  notes: string | null
  created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VSTYLE = {
  pending:      { icon: Clock,        label: 'Pending',  cls: 'text-yellow-400' },
  verified:     { icon: CheckCircle,  label: 'Verified', cls: 'text-emerald-400' },
  auto_verified:{ icon: CheckCircle,  label: 'Verified', cls: 'text-emerald-400' },
  rejected:     { icon: XCircle,      label: 'Rejected', cls: 'text-red-400' },
} as const

/**
 * Renders the Big Wins Board page with community and user-submitted wins.
 *
 * Shows a top-win banner (when available), a tabbed list of community or the
 * user's wins, and a modal to submit a new win. When viewing "My Wins" the
 * component exposes per-entry visibility toggles and keeps the displayed list
 * updated via React Query mutations and invalidation.
 *
 * @returns The rendered Big Wins page React element.
 */

export function BigWinsPage() {
  const [tab, setTab] = useState<'community' | 'mine'>('community')
  const [showSubmit, setShowSubmit] = useState(false)
  const queryClient = useQueryClient()

  const { data: communityWins = [], isLoading: loadingCommunity } = useQuery({
    queryKey: ['features', 'big-wins', 'community'],
    queryFn: () => api.features.bigWins(),
    enabled: tab === 'community',
  })

  const { data: myWins = [], isLoading: loadingMine } = useQuery({
    queryKey: ['features', 'big-wins', 'mine'],
    queryFn: () => api.features.myBigWins(),
    enabled: tab === 'mine',
  })

  const toggleVisibility = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.features.updateBigWin(id, { isPublic }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['features', 'big-wins'] }),
  })

  const wins = (tab === 'community' ? communityWins : myWins) as BigWin[]
  const isLoading = tab === 'community' ? loadingCommunity : loadingMine
  const topWin = (communityWins as BigWin[])[0] ?? null

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Big Wins Board</h1>
          <p className="text-zinc-400 text-sm mt-1">Community's biggest sweepstakes wins</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Submit Win
        </button>
      </div>

      {/* Top win banner */}
      {topWin && (
        <div className="bg-gradient-to-r from-yellow-900/30 to-zinc-900 rounded-xl border border-yellow-700/30 p-5 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Top Win</p>
            <p className="text-2xl font-bold text-jackpot tabular-nums">
              {formatSC(topWin.win_amount_sc)} SC
            </p>
            {topWin.game_name && (
              <p className="text-xs text-zinc-500 mt-1">{topWin.game_name}</p>
            )}
          </div>
          <div className="h-12 w-px bg-zinc-800 hidden sm:block" />
          <div>
            <p className="text-xs text-zinc-500 mb-1">By</p>
            <p className="text-white font-medium">{topWin.display_name ?? 'Anonymous'}</p>
          </div>
          <div className="h-12 w-px bg-zinc-800 hidden sm:block" />
          <div>
            <p className="text-xs text-zinc-500 mb-1">Total on Board</p>
            <p className="text-white font-bold">{(communityWins as BigWin[]).length}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {(['community', 'mine'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t === 'community' ? 'Community' : 'My Wins'}
          </button>
        ))}
      </div>

      {/* Wins list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : wins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trophy className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-400">
            {tab === 'community'
              ? 'No wins posted yet. Be the first!'
              : "You haven't submitted any wins yet."}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium w-8">#</th>
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium">Player</th>
                  <th className="text-left px-5 py-3 text-zinc-500 font-medium">Game / Platform</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Win Amount</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Multiplier</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Status</th>
                  <th className="text-right px-5 py-3 text-zinc-500 font-medium">Date</th>
                  {tab === 'mine' && <th className="px-5 py-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {wins.map((win, idx) => {
                  const vs = VSTYLE[win.verification_status] ?? VSTYLE.pending
                  const VIcon = vs.icon
                  return (
                    <tr
                      key={win.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-zinc-600 font-mono text-xs">{idx + 1}</td>
                      <td className="px-5 py-3.5 font-medium text-white">
                        {win.display_name ?? 'Anonymous'}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-zinc-300">{win.game_name ?? '—'}</p>
                        {win.platform_name && (
                          <p className="text-xs text-zinc-600">{win.platform_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-jackpot font-bold tabular-nums">
                          {formatSC(win.win_amount_sc)} SC
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-zinc-400 tabular-nums">
                        {win.multiplier != null ? `${Number(win.multiplier).toFixed(0)}×` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={cn('inline-flex items-center justify-end gap-1', vs.cls)}>
                          <VIcon className="w-3.5 h-3.5" />
                          <span className="text-xs">{vs.label}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-zinc-500 text-xs">
                        {timeAgo(win.occurred_at)}
                      </td>
                      {tab === 'mine' && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() =>
                              toggleVisibility.mutate({ id: win.id, isPublic: !win.is_public })
                            }
                            className="p-1 rounded hover:bg-zinc-700 transition-colors text-zinc-500 hover:text-zinc-300"
                            title={win.is_public ? 'Make private' : 'Make public'}
                          >
                            {win.is_public ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmit && (
        <SubmitWinModal
          onClose={() => setShowSubmit(false)}
          onSuccess={() => {
            setShowSubmit(false)
            setTab('mine')
            queryClient.invalidateQueries({ queryKey: ['features', 'big-wins'] })
          }}
        />
      )}
    </div>
  )
}

// ── Submit Modal ───────────────────────────────────────────────────────────────

type SubmitForm = {
  platformName: string
  gameName: string
  winAmountSc: string
  betAmount: string
  multiplier: string
  displayName: string
  occurredAt: string
  notes: string
  isPublic: boolean
}

/**
 * Render a modal for submitting a big win with fields for win amount, bet amount, game, platform, multiplier, date, display name, notes, and a public visibility toggle.
 *
 * @param onClose - Callback invoked when the modal is dismissed or the Cancel button is clicked.
 * @param onSuccess - Callback invoked after a successful submission.
 * @returns The modal UI as a JSX element.
 */
function SubmitWinModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState<SubmitForm>({
    platformName: '',
    gameName: '',
    winAmountSc: '',
    betAmount: '',
    multiplier: '',
    displayName: '',
    occurredAt: new Date().toISOString().split('T')[0],
    notes: '',
    isPublic: true,
  })
  const [error, setError] = useState<string | null>(null)

  const submitMutation = useMutation({
    mutationFn: () =>
      api.features.submitBigWin({
        platformName: form.platformName || undefined,
        gameName: form.gameName || undefined,
        winAmountSc: parseFloat(form.winAmountSc),
        betAmount: form.betAmount ? parseFloat(form.betAmount) : undefined,
        multiplier: form.multiplier ? parseFloat(form.multiplier) : undefined,
        displayName: form.displayName || undefined,
        occurredAt: new Date(form.occurredAt).toISOString(),
        notes: form.notes || undefined,
        isPublic: form.isPublic,
      }),
    onSuccess,
    onError: (e: Error) => setError(e.message),
  })

  const set = (key: keyof SubmitForm) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Submit a Big Win</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Win Amount (SC) *"
              type="number"
              value={form.winAmountSc}
              onChange={set('winAmountSc')}
              placeholder="e.g. 500.00"
            />
            <Field
              label="Bet Amount (SC)"
              type="number"
              value={form.betAmount}
              onChange={set('betAmount')}
              placeholder="optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Game Name"
              value={form.gameName}
              onChange={set('gameName')}
              placeholder="e.g. Sweet Bonanza"
            />
            <Field
              label="Platform"
              value={form.platformName}
              onChange={set('platformName')}
              placeholder="e.g. Chumba"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Multiplier"
              type="number"
              value={form.multiplier}
              onChange={set('multiplier')}
              placeholder="e.g. 250"
            />
            <Field
              label="Date"
              type="date"
              value={form.occurredAt}
              onChange={set('occurredAt')}
            />
          </div>
          <Field
            label="Display Name (optional)"
            value={form.displayName}
            onChange={set('displayName')}
            placeholder="Leave blank for Anonymous"
          />
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="Any context about this win..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => set('isPublic')(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-zinc-300">Show on community leaderboard</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!form.winAmountSc || submitMutation.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Win'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders a labeled input control bound to a string value and change handler.
 *
 * @param label - Text displayed above the input
 * @param value - Controlled input value
 * @param onChange - Callback invoked with the new string value when the input changes
 * @param placeholder - Optional placeholder text shown when the input is empty
 * @param type - HTML input `type` attribute (defaults to `'text'`)
 * @returns The JSX element containing the labeled input bound to the provided value and change handler
 */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500 transition-colors"
      />
    </div>
  )
}
