import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Plus, CheckCircle, Clock, XCircle, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { formatSC, timeAgo, cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { TextReveal } from '../components/fx/TextReveal'

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
  pending:       { icon: Clock,       label: 'Pending',  cls: 'text-yellow-400 bg-yellow-500/10 ring-1 ring-yellow-500/20' },
  verified:      { icon: CheckCircle, label: 'Verified', cls: 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20' },
  auto_verified: { icon: CheckCircle, label: 'Verified', cls: 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20' },
  rejected:      { icon: XCircle,     label: 'Rejected', cls: 'text-red-400 bg-red-500/10 ring-1 ring-red-500/20' },
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
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="heading-display text-white text-shimmer" stagger={50}>Big Wins Board</TextReveal>
          <p className="text-zinc-500 text-sm mt-1.5">Community's biggest sweepstakes wins</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="group flex items-center gap-2 px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-xl shadow-brand-500/20 press-scale"
        >
          <Plus className="w-4 h-4" />
          Submit Win
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      </ScrollReveal>

      {/* Top win banner */}
      {topWin && (
        <ScrollReveal delay={60}>
        <div className="glass-card-elevated rounded-2xl p-6 flex flex-wrap items-center gap-8 gradient-border-gold holo-surface">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-bold mb-1.5">Top Win</p>
            <p className="text-3xl font-black gradient-text-gold tabular-nums tracking-tight">
              {formatSC(topWin.win_amount_sc)} SC
            </p>
            {topWin.game_name && (
              <p className="text-xs text-zinc-500 mt-1.5">{topWin.game_name}</p>
            )}
          </div>
          <div className="h-14 w-px bg-white/[0.06] hidden sm:block" />
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-bold mb-1.5">By</p>
            <p className="text-white font-semibold">{topWin.display_name ?? 'Anonymous'}</p>
          </div>
          <div className="h-14 w-px bg-white/[0.06] hidden sm:block" />
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-bold mb-1.5">Total on Board</p>
            <p className="text-white font-bold text-xl tabular-nums">{(communityWins as BigWin[]).length}</p>
          </div>
        </div>
        </ScrollReveal>
      )}

      {/* Tabs */}
      <ScrollReveal delay={120}>
      <div className="flex gap-1 glass-card-static rounded-xl p-1 w-fit">
        {(['community', 'mine'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white/[0.08] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]',
            )}
          >
            {t === 'community' ? 'Community' : 'My Wins'}
          </button>
        ))}
      </div>
      </ScrollReveal>

      {/* Wins list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-20 shimmer" />
          ))}
        </div>
      ) : wins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-reveal-up">
          <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-jackpot/10 flex items-center justify-center mb-5">
            <Sparkles className="w-9 h-9 text-jackpot" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {tab === 'community' ? 'No wins posted yet' : 'No wins submitted'}
          </h3>
          <p className="text-zinc-500 text-sm text-pretty">
            {tab === 'community'
              ? 'Be the first to post a big win!'
              : "You haven't submitted any wins yet."}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden animate-reveal-up" style={{ animationDelay: '180ms' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em] w-8">#</th>
                  <th className="text-left px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Player</th>
                  <th className="text-left px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Game / Platform</th>
                  <th className="text-right px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Win Amount</th>
                  <th className="text-right px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Multiplier</th>
                  <th className="text-right px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Status</th>
                  <th className="text-right px-5 py-3.5 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.15em]">Date</th>
                  {tab === 'mine' && <th className="px-5 py-3.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {wins.map((win, idx) => {
                  const vs = VSTYLE[win.verification_status] ?? VSTYLE.pending
                  const VIcon = vs.icon
                  return (
                    <tr
                      key={win.id}
                      className="table-row-hover border-b border-white/[0.03] transition-colors"
                    >
                      <td className="px-5 py-4 text-zinc-600 font-mono text-xs tabular-nums">{idx + 1}</td>
                      <td className="px-5 py-4 font-semibold text-white">
                        {win.display_name ?? 'Anonymous'}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-zinc-300 font-medium">{win.game_name ?? '\u2014'}</p>
                        {win.platform_name && (
                          <p className="text-xs text-zinc-600 mt-0.5">{win.platform_name}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-jackpot font-bold tabular-nums">
                          {formatSC(win.win_amount_sc)} SC
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-zinc-400 tabular-nums font-medium">
                        {win.multiplier != null ? `${Number(win.multiplier).toFixed(0)}x` : '\u2014'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold', vs.cls)}>
                          <VIcon className="w-3 h-3" />
                          {vs.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-zinc-500 text-xs tabular-nums">
                        {timeAgo(win.occurred_at)}
                      </td>
                      {tab === 'mine' && (
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() =>
                              toggleVisibility.mutate({ id: win.id, isPublic: !win.is_public })
                            }
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-zinc-500 hover:text-zinc-300 press-scale"
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
    <div className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card-elevated rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-spring-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight">Submit a Big Win</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xl leading-none transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300 flex items-start gap-2 animate-spring-in">
            <span className="text-red-400 mt-0.5">✕</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Win Amount (SC) *" type="number" value={form.winAmountSc} onChange={set('winAmountSc')} placeholder="e.g. 500.00" />
            <Field label="Bet Amount (SC)" type="number" value={form.betAmount} onChange={set('betAmount')} placeholder="optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Game Name" value={form.gameName} onChange={set('gameName')} placeholder="e.g. Sweet Bonanza" />
            <Field label="Platform" value={form.platformName} onChange={set('platformName')} placeholder="e.g. Chumba" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Multiplier" type="number" value={form.multiplier} onChange={set('multiplier')} placeholder="e.g. 250" />
            <Field label="Date" type="date" value={form.occurredAt} onChange={set('occurredAt')} />
          </div>
          <Field label="Display Name (optional)" value={form.displayName} onChange={set('displayName')} placeholder="Leave blank for Anonymous" />
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold mb-1.5 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="Any context about this win..."
              rows={2}
              className="w-full glass-input text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => set('isPublic')(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-zinc-300 font-medium">Show on community leaderboard</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] text-zinc-300 text-sm font-medium transition-colors press-scale"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!form.winAmountSc || submitMutation.isPending}
            className="flex-1 px-4 py-2.5 btn-primary text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 shadow-xl shadow-brand-500/20 press-scale"
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
      <label className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full glass-input text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
      />
    </div>
  )
}
