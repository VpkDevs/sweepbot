import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  BellOff,
  Search,
  Shield,
  RefreshCw,
  Clock,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  TrendingUp,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, timeAgo } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { AnimatedCounter } from '../components/fx/AnimatedCounter'
import { TextReveal } from '../components/fx/TextReveal'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'major' | 'moderate' | 'minor' | 'info'

interface TosChange {
  id: string
  platform_id: string
  platform_name: string
  platform_url?: string
  severity: Severity
  change_type:
    | 'withdrawal_policy'
    | 'bonus_terms'
    | 'eligibility'
    | 'account_rules'
    | 'sweeps_rules'
    | 'other'
  summary: string
  detected_at: string
  effective_date?: string
  sections_changed: string[]
  added_lines?: number
  removed_lines?: number
  diff_preview?: string
}

interface TosStats {
  monitored_platforms: number
  changes_this_week: number
  major_alerts: number
  last_scan_at: string
  watching_count: number
}

interface WatchedPlatform {
  platform_id: string
  platform_name: string
  watching: boolean
  last_change_at?: string
  change_count_30d: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  Severity,
  {
    label: string
    icon: React.ElementType
    bg: string
    border: string
    text: string
    dot: string
    badge: string
  }
> = {
  major: {
    label: 'Major Alert',
    icon: AlertTriangle,
    bg: 'bg-red-950/40',
    border: 'border-red-800/60',
    text: 'text-red-300',
    dot: 'bg-red-400',
    badge: 'bg-red-900/50 text-red-300 border-red-700',
  },
  moderate: {
    label: 'Moderate',
    icon: AlertCircle,
    bg: 'bg-orange-950/30',
    border: 'border-orange-800/50',
    text: 'text-orange-300',
    dot: 'bg-orange-400',
    badge: 'bg-orange-900/40 text-orange-300 border-orange-700',
  },
  minor: {
    label: 'Minor',
    icon: Info,
    bg: 'bg-yellow-950/20',
    border: 'border-yellow-800/30',
    text: 'text-yellow-300',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  },
  info: {
    label: 'Info',
    icon: Info,
    bg: 'bg-zinc-900',
    border: 'border-zinc-800',
    text: 'text-zinc-400',
    dot: 'bg-zinc-500',
    badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
}

const CHANGE_TYPE_LABELS: Record<TosChange['change_type'], string> = {
  withdrawal_policy: 'Withdrawal Policy',
  bonus_terms: 'Bonus Terms',
  eligibility: 'Eligibility',
  account_rules: 'Account Rules',
  sweeps_rules: 'Sweeps Rules',
  other: 'General',
}

// ─── Stub data (replaces API when no real backend) ────────────────────────────

const STUB_CHANGES: TosChange[] = [
  {
    id: 'c1',
    platform_id: 'chumba',
    platform_name: 'Chumba Casino',
    platform_url: 'https://www.chumbacasino.com',
    severity: 'major',
    change_type: 'withdrawal_policy',
    summary: 'New $100 minimum SC redemption threshold added. Previously no minimum was listed.',
    detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    effective_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Section 8.3 — Sweeps Coin Redemption', 'Section 8.5 — Processing Times'],
    added_lines: 3,
    removed_lines: 1,
    diff_preview:
      '- Sweeps Coins may be redeemed for prizes at any balance.\n+ Sweeps Coins may be redeemed for prizes with a minimum balance of 100 SC ($100 equivalent).\n+ Accounts with balances below 100 SC must accumulate to this threshold before redemption is permitted.\n+ This policy takes effect 7 days from the date of this notice.',
  },
  {
    id: 'c2',
    platform_id: 'pulsz',
    platform_name: 'Pulsz Casino',
    severity: 'moderate',
    change_type: 'bonus_terms',
    summary:
      'Welcome bonus wagering requirement increased from 1× to 3× for new accounts registered after March 1.',
    detected_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    effective_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Section 4.1 — Welcome Bonus', 'Section 4.7 — Playthrough Requirements'],
    added_lines: 5,
    removed_lines: 4,
    diff_preview:
      '- New players receive a welcome package with a 1× playthrough requirement.\n+ New players registered after March 1, 2026 must complete a 3× playthrough\n+ on their welcome bonus before prize redemption is permitted.\n+ This change applies only to accounts created on or after the effective date.',
  },
  {
    id: 'c3',
    platform_id: 'wow_vegas',
    platform_name: 'WOW Vegas',
    severity: 'major',
    change_type: 'eligibility',
    summary:
      'Players in Nebraska and Alabama now restricted from prize redemption. State list expanded.',
    detected_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Appendix A — Eligible States'],
    added_lines: 2,
    removed_lines: 0,
    diff_preview:
      '  Eligible States: AL, AK, AZ, AR, CA...\n+ Note: Players in Nebraska (NE) and Alabama (AL) are no longer eligible for prize redemptions effective immediately.\n+ Affected accounts will be notified by email within 72 hours.',
  },
  {
    id: 'c4',
    platform_id: 'fortune_coins',
    platform_name: 'Fortune Coins',
    severity: 'minor',
    change_type: 'account_rules',
    summary:
      'Inactivity period reduced from 180 days to 90 days before account dormancy fees apply.',
    detected_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Section 11 — Inactive Accounts'],
    added_lines: 2,
    removed_lines: 2,
    diff_preview:
      '- An account is considered inactive after 180 consecutive days of no login activity.\n- Dormant accounts may be subject to a $5/month maintenance fee after 180 days.\n+ An account is considered inactive after 90 consecutive days of no login activity.\n+ Dormant accounts may be subject to a $5/month maintenance fee after 90 days.',
  },
  {
    id: 'c5',
    platform_id: 'stake_us',
    platform_name: 'Stake.us',
    severity: 'moderate',
    change_type: 'sweeps_rules',
    summary:
      'SC redemption processing window extended from "5–7 business days" to "7–14 business days" for ACH transfers.',
    detected_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Section 9.4 — Redemption Processing Times'],
    added_lines: 1,
    removed_lines: 1,
    diff_preview:
      '- ACH bank transfer redemptions are processed within 5–7 business days.\n+ ACH bank transfer redemptions are processed within 7–14 business days.',
  },
  {
    id: 'c6',
    platform_id: 'global_poker',
    platform_name: 'Global Poker',
    severity: 'info',
    change_type: 'other',
    summary:
      'Privacy policy updated to reflect new third-party analytics partnerships. No gameplay changes.',
    detected_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    sections_changed: ['Privacy Policy — Section 3', 'Privacy Policy — Section 7'],
    added_lines: 12,
    removed_lines: 8,
  },
]

const STUB_STATS: TosStats = {
  monitored_platforms: 47,
  changes_this_week: 6,
  major_alerts: 2,
  last_scan_at: new Date(Date.now() - 23 * 60 * 1000).toISOString(),
  watching_count: 12,
}

const STUB_WATCHLIST: WatchedPlatform[] = [
  {
    platform_id: 'chumba',
    platform_name: 'Chumba Casino',
    watching: true,
    last_change_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 3,
  },
  {
    platform_id: 'pulsz',
    platform_name: 'Pulsz Casino',
    watching: true,
    last_change_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 2,
  },
  {
    platform_id: 'wow_vegas',
    platform_name: 'WOW Vegas',
    watching: true,
    last_change_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 4,
  },
  {
    platform_id: 'global_poker',
    platform_name: 'Global Poker',
    watching: false,
    last_change_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 1,
  },
  {
    platform_id: 'fortune_coins',
    platform_name: 'Fortune Coins',
    watching: true,
    last_change_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 1,
  },
  {
    platform_id: 'stake_us',
    platform_name: 'Stake.us',
    watching: true,
    last_change_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    change_count_30d: 2,
  },
]

// ─── Pulsing live indicator ────────────────────────────────────────────────────

function LiveIndicator({ lastScanAt }: { lastScanAt: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-green-800/40 bg-green-900/20 px-3 py-1.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
      </span>
      <span className="text-xs font-medium text-green-400">Monitoring Active</span>
      <span className="text-xs text-zinc-600">·</span>
      <span className="text-xs text-zinc-500">Scanned {timeAgo(lastScanAt)}</span>
    </div>
  )
}

// ─── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        cfg.badge
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Diff viewer ──────────────────────────────────────────────────────────────

function DiffViewer({ diff, changeId }: { diff?: string; changeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tos-diff', changeId],
    queryFn: () => api.tos.diff(changeId),
    enabled: !diff,
    staleTime: Infinity,
    retry: false,
  })

  const rawDiff = diff ?? (data as { diff?: string })?.diff

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-1 p-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 rounded bg-zinc-800" style={{ width: `${60 + i * 10}%` }} />
        ))}
      </div>
    )
  }

  if (!rawDiff) return null

  const lines = rawDiff.split('\n')

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Diff Preview
        </span>
        <div className="flex gap-3">
          <span className="text-[10px] text-green-400">+ added</span>
          <span className="text-[10px] text-red-400">- removed</span>
        </div>
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto p-3">
        {lines.map((line, idx) => {
          const isAdded = line.startsWith('+')
          const isRemoved = line.startsWith('-')
          return (
            <div
              key={idx}
              className={cn(
                'rounded px-2 py-0.5 leading-relaxed',
                isAdded && 'bg-green-900/30 text-green-300',
                isRemoved && 'bg-red-900/30 text-red-300 line-through opacity-70',
                !isAdded && !isRemoved && 'text-zinc-500'
              )}
            >
              {line || ' '}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Change card ──────────────────────────────────────────────────────────────

function ChangeCard({ change, index }: { change: TosChange; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[change.severity]

  return (
    <ScrollReveal delay={index * 60}>
      <SpotlightCard
        className={cn(
          'overflow-hidden rounded-xl border transition-all duration-300',
          cfg.bg,
          cfg.border,
          expanded && 'ring-brand-500/20 ring-1'
        )}
        spotlightColor="rgba(139,92,246,0.06)"
      >
        <button
          className="w-full p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {/* Top row */}
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5 mt-1.5 h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{change.platform_name}</span>
                <SeverityBadge severity={change.severity} />
                <span className="rounded-full border border-zinc-700/50 bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-600">
                  {CHANGE_TYPE_LABELS[change.change_type]}
                </span>
              </div>
              <p className="text-sm leading-snug text-zinc-300">{change.summary}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="whitespace-nowrap text-xs text-zinc-500">
                {timeAgo(change.detected_at)}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-zinc-600 transition-transform duration-300',
                  expanded && 'rotate-180'
                )}
              />
            </div>
          </div>

          {/* Pill row */}
          <div className="ml-5 mt-3 flex flex-wrap gap-1.5">
            {change.sections_changed.map((s) => (
              <span
                key={s}
                className="rounded-full border border-zinc-700/40 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500"
              >
                {s}
              </span>
            ))}
            {change.added_lines || change.removed_lines ? (
              <span className="ml-auto text-[10px] text-zinc-600">
                {change.added_lines ? (
                  <span className="text-green-500">+{change.added_lines}</span>
                ) : null}
                {change.added_lines && change.removed_lines ? ' / ' : null}
                {change.removed_lines ? (
                  <span className="text-red-500">-{change.removed_lines}</span>
                ) : null}{' '}
                lines
              </span>
            ) : null}
          </div>
        </button>

        {/* Expanded details */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-500 ease-in-out',
            expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="ml-5 space-y-3 px-4 pb-4">
            {change.effective_date && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-zinc-500">Effective:</span>
                <span className="font-medium text-zinc-300">
                  {new Date(change.effective_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {change.diff_preview && <DiffViewer diff={change.diff_preview} changeId={change.id} />}

            <div className="flex items-center justify-between">
              {change.platform_url && (
                <a
                  href={change.platform_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-xs transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on site <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <span className="ml-auto text-[10px] text-zinc-600">
                Detected {new Date(change.detected_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </ScrollReveal>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  alert,
}: {
  label: string
  value: number
  sub: string
  icon: React.ElementType
  color: string
  alert?: boolean
}) {
  return (
    <SpotlightCard className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
          <div className={cn('text-3xl font-black tabular-nums', color)}>
            <AnimatedCounter value={value} />
          </div>
          <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>
        </div>
        <div className={cn('rounded-lg p-2', alert ? 'bg-red-900/20' : 'bg-zinc-800')}>
          <Icon className={cn('h-5 w-5', color)} />
          {alert && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-red-500" />
          )}
        </div>
      </div>
    </SpotlightCard>
  )
}

// ─── Watchlist sidebar ────────────────────────────────────────────────────────

function WatchlistPanel({ platforms }: { platforms: WatchedPlatform[] }) {
  const qc = useQueryClient()

  const watchMutation = useMutation({
    mutationFn: ({ platformId, watching }: { platformId: string; watching: boolean }) =>
      api.tos.watch(platformId, watching),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tos-watchlist'] }),
  })

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="text-brand-400 h-4 w-4" />
          <h3 className="text-sm font-semibold text-white">Watchlist</h3>
        </div>
        <span className="text-xs text-zinc-600">
          {platforms.filter((p) => p.watching).length} watched
        </span>
      </div>
      <div className="divide-y divide-zinc-800/60">
        {platforms.map((p) => (
          <div
            key={p.platform_id}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">{p.platform_name}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {p.last_change_at && (
                  <span className="text-[10px] text-zinc-600">
                    Changed {timeAgo(p.last_change_at)}
                  </span>
                )}
                {p.change_count_30d > 0 && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      p.change_count_30d >= 3
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-zinc-800 text-zinc-500'
                    )}
                  >
                    {p.change_count_30d} change{p.change_count_30d !== 1 ? 's' : ''}/30d
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                watchMutation.mutate({ platformId: p.platform_id, watching: !p.watching })
              }
              disabled={watchMutation.isPending}
              className={cn(
                'shrink-0 rounded-lg p-1.5 transition-all',
                p.watching
                  ? 'bg-brand-500/15 text-brand-400 hover:bg-red-900/20 hover:text-red-400'
                  : 'hover:bg-brand-500/15 hover:text-brand-400 bg-zinc-800 text-zinc-600'
              )}
              title={p.watching ? 'Stop watching' : 'Watch this platform'}
            >
              {p.watching ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Scrolling ticker ─────────────────────────────────────────────────────────

function AlertTicker({ changes }: { changes: TosChange[] }) {
  const majorChanges = changes.filter((c) => c.severity === 'major' || c.severity === 'moderate')
  if (majorChanges.length === 0) return null

  return (
    <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-red-800/40 bg-red-950/30">
      <div className="flex shrink-0 items-center gap-2 border-r border-red-800/40 bg-red-900/40 px-4 py-2.5">
        <Zap className="h-4 w-4 animate-pulse text-red-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-red-300">Live Alerts</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex w-max animate-[marquee_30s_linear_infinite] gap-8 px-6 py-2.5">
          {[...majorChanges, ...majorChanges].map((c, i) => (
            <span
              key={`${c.id}-${i}`}
              className="flex items-center gap-2 whitespace-nowrap text-xs text-red-200"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <strong>{c.platform_name}:</strong> {c.summary.slice(0, 80)}
              {c.summary.length > 80 ? '…' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline visualization ───────────────────────────────────────────────────

function ActivityTimeline({ changes }: { changes: TosChange[] }) {
  // Group by day
  const byDay = changes.reduce<Record<string, TosChange[]>>((acc, c) => {
    const day = new Date(c.detected_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    acc[day] = [...(acc[day] ?? []), c]
    return acc
  }, {})

  const entries = Object.entries(byDay).slice(0, 7)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Activity (Last 7 Days)
      </h3>
      <div className="space-y-2">
        {entries.map(([day, dayChanges], idx) => {
          const maxCount = Math.max(...entries.map(([, cs]) => cs.length))
          const pct = (dayChanges.length / Math.max(maxCount, 1)) * 100
          const hasMajor = dayChanges.some((c) => c.severity === 'major')
          return (
            <div key={day} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-xs text-zinc-600">{day}</span>
              <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    hasMajor
                      ? 'bg-gradient-to-r from-red-600 to-red-500'
                      : 'from-brand-700 to-brand-500 bg-gradient-to-r'
                  )}
                  style={{
                    width: `${pct}%`,
                    animationDelay: `${idx * 100}ms`,
                  }}
                />
              </div>
              <span
                className={cn(
                  'w-5 shrink-0 text-right text-xs font-bold tabular-nums',
                  hasMajor ? 'text-red-400' : 'text-zinc-400'
                )}
              >
                {dayChanges.length}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TosMonitorPage() {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all')
  const [showWatchedOnly, setShowWatchedOnly] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const qc = useQueryClient()

  // Fetch with graceful fallback to stub data
  const { data: statsData } = useQuery({
    queryKey: ['tos-stats'],
    queryFn: () => api.tos.stats(),
    staleTime: 60_000,
    retry: false,
  })

  const { data: changesData, isLoading } = useQuery({
    queryKey: ['tos-changes'],
    queryFn: () => api.tos.changes({ limit: 50 }),
    staleTime: 120_000,
    retry: false,
  })

  const { data: watchlistData } = useQuery({
    queryKey: ['tos-watchlist'],
    queryFn: () => api.tos.watchlist(),
    staleTime: 120_000,
    retry: false,
  })

  // Graceful fallback
  const stats = (statsData as TosStats | undefined) ?? STUB_STATS
  const changes = (changesData as TosChange[] | undefined) ?? STUB_CHANGES
  const watchlist = (watchlistData as WatchedPlatform[] | undefined) ?? STUB_WATCHLIST

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await qc.invalidateQueries({ queryKey: ['tos-changes'] })
    await qc.invalidateQueries({ queryKey: ['tos-stats'] })
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  // Filter changes
  const watchedPlatformIds = new Set(watchlist.filter((p) => p.watching).map((p) => p.platform_id))

  const filtered = changes.filter((c) => {
    if (showWatchedOnly && !watchedPlatformIds.has(c.platform_id)) return false
    if (severityFilter !== 'all' && c.severity !== severityFilter) return false
    if (changeTypeFilter !== 'all' && c.change_type !== changeTypeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.platform_name.toLowerCase().includes(q) && !c.summary.toLowerCase().includes(q))
        return false
    }
    return true
  })

  const majorCount = changes.filter((c) => c.severity === 'major').length
  const moderateCount = changes.filter((c) => c.severity === 'moderate').length

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <ScrollReveal>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <TextReveal as="h1" className="text-2xl font-bold text-white">
              TOS Monitor
            </TextReveal>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              SweepBot automatically scans Terms of Service across every major platform and alerts
              you the moment something changes — so you&apos;re never blindsided.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LiveIndicator lastScanAt={stats.last_scan_at} />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition-all hover:bg-zinc-700 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Major alert ticker ───────────────────────────────── */}
      {(majorCount > 0 || moderateCount > 0) && (
        <ScrollReveal delay={80}>
          <AlertTicker changes={changes} />
        </ScrollReveal>
      )}

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Platforms Monitored',
            value: stats.monitored_platforms,
            sub: 'auto-scanned daily',
            icon: Shield,
            color: 'text-brand-400',
          },
          {
            label: 'Changes This Week',
            value: stats.changes_this_week,
            sub: 'across all platforms',
            icon: FileText,
            color: 'text-blue-400',
          },
          {
            label: 'Major Alerts',
            value: stats.major_alerts,
            sub: 'require your attention',
            icon: AlertTriangle,
            color: majorCount > 0 ? 'text-red-400' : 'text-zinc-500',
            alert: majorCount > 0,
          },
          {
            label: 'Platforms Watching',
            value: stats.watching_count,
            sub: 'in your watchlist',
            icon: Bell,
            color: 'text-green-400',
          },
        ].map((item, i) => (
          <ScrollReveal key={item.label} delay={i * 60}>
            <StatCard {...item} />
          </ScrollReveal>
        ))}
      </div>

      {/* ── Main two-column layout ──────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: change feed ─────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Search + filters */}
          <ScrollReveal delay={100}>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search platforms or change description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2"
                />
              </div>
              <select
                aria-label="Filter by severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
                className="focus:ring-brand-500 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2"
              >
                <option value="all">All Severities</option>
                <option value="major">Major Alerts</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
                <option value="info">Info</option>
              </select>
              <select
                aria-label="Filter by change type"
                value={changeTypeFilter}
                onChange={(e) => setChangeTypeFilter(e.target.value)}
                className="focus:ring-brand-500 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2"
              >
                <option value="all">All Types</option>
                {Object.entries(CHANGE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowWatchedOnly((v) => !v)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  showWatchedOnly
                    ? 'bg-brand-500/15 text-brand-300 border-brand-700'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                )}
              >
                {showWatchedOnly ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                Watched Only
              </button>
            </div>
          </ScrollReveal>

          {/* Results count */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-zinc-500">
              {isLoading
                ? 'Loading…'
                : `${filtered.length} change${filtered.length !== 1 ? 's' : ''}`}
              {filtered.length !== changes.length && (
                <span className="text-zinc-600"> (of {changes.length} total)</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {Object.entries({
                major: 'text-red-400',
                moderate: 'text-orange-400',
                minor: 'text-yellow-400',
              }).map(([sev, cls]) => {
                const count = changes.filter((c) => c.severity === sev).length
                return count > 0 ? (
                  <span key={sev} className={cn('text-xs font-medium', cls)}>
                    {count} {sev}
                  </span>
                ) : null
              })}
            </div>
          </div>

          {/* Change cards */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500/50" />
              <p className="text-sm text-zinc-500">No changes match your filters</p>
              <button
                onClick={() => {
                  setSearch('')
                  setSeverityFilter('all')
                  setChangeTypeFilter('all')
                  setShowWatchedOnly(false)
                }}
                className="text-brand-400 hover:text-brand-300 mt-3 text-xs transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((change, idx) => (
                <ChangeCard key={change.id} change={change} index={idx} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: sidebar ─────────────────────────────── */}
        <div className="space-y-4">
          <ScrollReveal delay={80}>
            <WatchlistPanel platforms={watchlist} />
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <ActivityTimeline changes={changes} />
          </ScrollReveal>

          {/* Methodology card */}
          <ScrollReveal delay={160}>
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-2">
                <Shield className="text-brand-400 h-4 w-4" />
                <h3 className="text-sm font-semibold text-white">How SweepBot Scans</h3>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Clock, text: 'Full platform scans run every 6 hours' },
                  { icon: Zap, text: 'Critical sections re-checked every 30 minutes' },
                  { icon: AlertTriangle, text: 'Major alerts trigger instant notification' },
                  { icon: TrendingUp, text: 'Full change history retained for 2 years' },
                  { icon: FileText, text: 'Diffs preserved for legal reference' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <p className="text-xs text-zinc-500">{text}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-2">
                <p className="text-xs text-zinc-600">
                  Suspected policy violations or missing platforms?{' '}
                  <a
                    href="mailto:ops@sweepbot.io"
                    className="text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Report it →
                  </a>
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Pro upgrade CTA */}
          <ScrollReveal delay={200}>
            <div className="from-brand-950/70 border-brand-800/40 relative overflow-hidden rounded-xl border bg-gradient-to-br to-zinc-900 p-4">
              <div className="bg-brand-500/10 absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl" />
              <div className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <Bell className="text-brand-400 h-4 w-4" />
                  <span className="text-brand-300 text-xs font-bold uppercase tracking-wide">
                    Pro Feature
                  </span>
                </div>
                <p className="mb-1 text-sm font-semibold text-white">Instant TOS Alerts</p>
                <p className="mb-3 text-xs text-zinc-400">
                  Get push, email, and in-app notifications the moment a major TOS change is
                  detected on any platform you care about.
                </p>
                <a
                  href="/pricing"
                  className="bg-brand-600 hover:bg-brand-500 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  Upgrade to Pro <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  )
}
