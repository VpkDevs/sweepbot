import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Plus,
  Play,
  Pause,
  Trash2,
  Share2,
  Bot,
  Zap,
  Clock,
  ArrowRight,
  Sparkles,
  Search,
  Copy,
  CheckCircle2,
  XCircle,
  Coffee,
  DollarSign,
  Calendar,
  Gift,
  Repeat,
  BarChart3,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../lib/api'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'
import { AnimatedCounter } from '../components/fx/AnimatedCounter'
import { cn, timeAgo } from '../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flow {
  id: string
  name: string
  description: string
  status: 'active' | 'draft' | 'paused' | 'archived'
  executionCount: number
  lastExecutedAt?: string
  trigger?: { type: string; schedule?: string }
  guardrails?: unknown[]
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active: {
    dot: 'bg-emerald-400 animate-pulse',
    cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
    label: 'Active',
  },
  draft: {
    dot: 'bg-zinc-500',
    cls: 'bg-zinc-700/50 text-zinc-300 ring-1 ring-zinc-600/30',
    label: 'Draft',
  },
  paused: {
    dot: 'bg-yellow-400',
    cls: 'bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/20',
    label: 'Paused',
  },
  archived: {
    dot: 'bg-zinc-700',
    cls: 'bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700/30',
    label: 'Archived',
  },
} as const

// ─── Flow templates ───────────────────────────────────────────────────────────

interface FlowTemplate {
  id: string
  name: string
  description: string
  prompt: string
  icon: React.ElementType
  category: 'daily' | 'bonus' | 'smart' | 'safety'
  color: string
  badge?: string
}

const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'daily-bonus-all',
    name: 'Daily Bonus Run',
    description: 'Claim daily login bonuses across all your platforms every morning.',
    prompt: 'Every day at 9 AM, open all my platforms and claim the daily login bonus on each one.',
    icon: Coffee,
    category: 'daily',
    color: 'from-amber-600/20 to-orange-900/10 border-amber-800/30',
    badge: 'Most Popular',
  },
  {
    id: 'sc-threshold',
    name: 'SC Threshold Alert',
    description: 'Auto-notify when your SC balance crosses a redemption threshold.',
    prompt: 'Watch my Chumba balance. When it reaches 100 SC, send me a notification to redeem.',
    icon: DollarSign,
    category: 'smart',
    color: 'from-green-600/20 to-emerald-900/10 border-green-800/30',
    badge: 'Smart',
  },
  {
    id: 'bonus-hunt',
    name: 'Bonus Hunt Session',
    description: 'Play at minimum bet on Sweet Bonanza hunting for the bonus game trigger.',
    prompt:
      'Open Pulsz, find Sweet Bonanza, play at minimum bet. If bonus triggers, play it out. Stop after 50 spins or if I lose 20 SC.',
    icon: Sparkles,
    category: 'bonus',
    color: 'from-purple-600/20 to-brand-900/10 border-brand-800/30',
    badge: 'Fan Favorite',
  },
  {
    id: 'weekly-mail-check',
    name: 'Weekly Mail Scraper',
    description: 'Scan your email weekly for casino promo codes and claim them automatically.',
    prompt:
      'Every Sunday morning, scan my Gmail for sweepstakes casino emails and claim any promo codes or free coins.',
    icon: Gift,
    category: 'bonus',
    color: 'from-cyan-600/20 to-blue-900/10 border-cyan-800/30',
  },
  {
    id: 'loss-limit',
    name: 'Responsible Play Guard',
    description: 'Automatically pause all activity if daily losses exceed your set limit.',
    prompt:
      'Monitor my daily losses across all platforms. If I lose more than $50 in a single day, pause all active flows and send me an alert.',
    icon: AlertTriangle,
    category: 'safety',
    color: 'from-red-600/20 to-red-900/10 border-red-800/30',
    badge: 'Safety',
  },
  {
    id: 'jackpot-chase',
    name: 'Jackpot Velocity Alert',
    description: 'Alert when a tracked jackpot grows faster than its historical average.',
    prompt:
      'Monitor the Chumba progressive jackpots. When any jackpot grows more than 20% in an hour, send me an urgent notification.',
    icon: BarChart3,
    category: 'smart',
    color: 'from-yellow-600/20 to-amber-900/10 border-yellow-800/30',
  },
  {
    id: 'scheduled-session',
    name: 'Scheduled Session',
    description: 'Book a dedicated play session with automatic start, limits, and stop.',
    prompt:
      'Every Friday at 7 PM, open WOW Vegas. Play Book of Dead at $0.20 bet for 30 minutes or until I win 3x my starting balance. Then stop.',
    icon: Calendar,
    category: 'daily',
    color: 'from-blue-600/20 to-indigo-900/10 border-blue-800/30',
  },
  {
    id: 'platform-loop',
    name: 'Multi-Platform Loop',
    description: 'Cycle through platforms collecting daily free coins in a single run.',
    prompt:
      'Every morning, loop through Chumba, Pulsz, WOW Vegas, Global Poker, and Stake.us. On each one, collect free daily coins, then move to the next.',
    icon: Repeat,
    category: 'daily',
    color: 'from-violet-600/20 to-purple-900/10 border-violet-800/30',
    badge: 'New',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  daily: 'Daily',
  bonus: 'Bonus',
  smart: 'Smart',
  safety: 'Safety',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlowStatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  sub: string
  icon: React.ElementType
  color: string
}) {
  return (
    <SpotlightCard className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
          <p className={cn('text-3xl font-black tabular-nums', color)}>
            <AnimatedCounter value={value} />
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2">
          <Icon className={cn('h-5 w-5', color)} />
        </div>
      </div>
    </SpotlightCard>
  )
}

function TemplateCard({
  template,
  onUse,
}: {
  template: FlowTemplate
  onUse: (t: FlowTemplate) => void
}) {
  const Icon = template.icon
  return (
    <SpotlightCard
      className={cn(
        'group relative cursor-pointer rounded-xl border bg-gradient-to-br p-4 transition-all hover:scale-[1.01]',
        template.color
      )}
      spotlightColor="rgba(255,255,255,0.04)"
    >
      {template.badge && (
        <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
          {template.badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2">
          <Icon className="h-5 w-5 text-white/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold text-white">{template.name}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
            {template.description}
          </p>
        </div>
      </div>
      <button
        onClick={() => onUse(template)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
      >
        Use Template <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </SpotlightCard>
  )
}

function DeleteConfirmModal({
  flowName,
  onConfirm,
  onCancel,
  isPending,
}: {
  flowName: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="animate-spring-in relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Delete Flow?</p>
            <p className="text-xs text-zinc-500">This cannot be undone.</p>
          </div>
        </div>
        <p className="mb-5 text-sm text-zinc-400">
          You are about to permanently delete <strong className="text-white">{flowName}</strong> and
          all its execution history.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-zinc-800 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function FlowCard({
  flow,
  onView,
  onActivate,
  onPause,
  onDuplicate,
  onDelete,
}: {
  flow: Flow
  onView: () => void
  onActivate: () => void
  onPause: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const statusStyle = STATUS_STYLES[flow.status] ?? STATUS_STYLES.draft
  const [copied, setCopied] = useState(false)

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    void navigator.clipboard.writeText(`SweepBot Flow: ${flow.name}\n${flow.description}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SpotlightCard
      className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700"
      onClick={onView}
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h3 className="group-hover:text-brand-300 truncate text-sm font-semibold text-white transition-colors">
                {flow.name}
              </h3>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  statusStyle.cls
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                {statusStyle.label}
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">{flow.description}</p>
          </div>
          <div className="bg-brand-500/10 group-hover:bg-brand-500/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors">
            <Bot className="text-brand-400 h-4 w-4" />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span className="font-medium tabular-nums">{flow.executionCount ?? 0}</span> runs
          </span>
          {flow.trigger?.type && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {flow.trigger.schedule ?? flow.trigger.type}
            </span>
          )}
          {flow.lastExecutedAt && (
            <span className="ml-auto">Last run {timeAgo(flow.lastExecutedAt)}</span>
          )}
        </div>

        {(flow.guardrails?.length ?? 0) > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(flow.guardrails ?? []).slice(0, 3).map((g: unknown, i: number) => {
              const guard = g as Record<string, unknown>
              return (
                <span
                  key={i}
                  className="rounded-full border border-green-800/40 bg-green-900/20 px-2 py-0.5 text-[10px] text-green-400"
                >
                  {guard['type'] as string}: {String(guard['value'])}
                </span>
              )
            })}
          </div>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {(flow.status === 'draft' || flow.status === 'paused') && (
            <button
              onClick={onActivate}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <Play className="h-3 w-3" /> Activate
            </button>
          )}
          {flow.status === 'active' && (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/20"
            >
              <Pause className="h-3 w-3" /> Pause
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Copy className="h-3 w-3" /> Duplicate
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
          >
            {copied ? (
              <CheckCircle2 className="h-3 w-3 text-green-400" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </div>
    </SpotlightCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FlowsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'paused'>('all')
  const [search, setSearch] = useState('')
  const [templateCategory, setTemplateCategory] = useState('all')
  const [showTemplates, setShowTemplates] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const { data: rawFlows = [], isLoading } = useQuery({
    queryKey: ['flows', { filter, page: 1 }],
    queryFn: () => api.flows.list({ page: 1, pageSize: 50 }),
    staleTime: 30_000,
  })

  const flows = rawFlows as unknown as Flow[]

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.flows.update(id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.flows.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['flows'] })
      setDeleteTarget(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.flows.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['flows'] })
      navigate({ to: `/flows/${(result as Record<string, unknown>)['id'] as string}` })
    },
  })

  const handleUseTemplate = (_template: FlowTemplate) => {
    navigate({ to: '/flows/new' })
  }

  const stats = useMemo(
    () => ({
      total: flows.length,
      active: flows.filter((f) => f.status === 'active').length,
      totalRuns: flows.reduce((acc, f) => acc + (f.executionCount ?? 0), 0),
      lastRun: flows.reduce<string | null>((latest, f) => {
        if (!f.lastExecutedAt) return latest
        if (!latest) return f.lastExecutedAt
        return f.lastExecutedAt > latest ? f.lastExecutedAt : latest
      }, null),
    }),
    [flows]
  )

  const filteredFlows = useMemo(
    () =>
      flows.filter((f) => {
        if (filter !== 'all' && f.status !== filter) return false
        if (search) {
          const q = search.toLowerCase()
          if (!f.name?.toLowerCase().includes(q) && !f.description?.toLowerCase().includes(q))
            return false
        }
        return true
      }),
    [flows, filter, search]
  )

  const filteredTemplates = useMemo(
    () =>
      FLOW_TEMPLATES.filter((t) => templateCategory === 'all' || t.category === templateCategory),
    [templateCategory]
  )

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <TextReveal as="h1" className="heading-display text-shimmer text-white" stagger={50}>
              SweepBot Flows
            </TextReveal>
            <p className="mt-1.5 text-sm text-zinc-500">
              Automate your sweepstakes casino routine in plain English
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700"
            >
              <Sparkles className="text-brand-400 h-4 w-4" />
              Templates
            </button>
            <button
              onClick={() => navigate({ to: '/flows/new' })}
              className="bg-brand-600 hover:bg-brand-500 shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-xl transition-all"
            >
              <Plus className="h-4 w-4" />
              New Flow
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Total Flows',
            value: stats.total,
            sub: 'created',
            icon: Bot,
            color: 'text-brand-400',
          },
          {
            label: 'Active Now',
            value: stats.active,
            sub: 'running automatically',
            icon: Zap,
            color: 'text-emerald-400',
          },
          {
            label: 'Total Runs',
            value: stats.totalRuns,
            sub: 'all-time executions',
            icon: Repeat,
            color: 'text-blue-400',
          },
          {
            label: 'Guarded',
            value: flows.filter((f) => (f.guardrails?.length ?? 0) > 0).length,
            sub: 'flows with guardrails',
            icon: AlertTriangle,
            color: 'text-amber-400',
          },
        ].map((item, i) => (
          <ScrollReveal key={item.label} delay={i * 60}>
            <FlowStatCard {...item} />
          </ScrollReveal>
        ))}
      </div>

      {/* Template gallery */}
      {showTemplates && (
        <ScrollReveal>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-brand-400 h-4 w-4" />
                <h2 className="text-sm font-bold text-white">Flow Templates</h2>
                <span className="text-xs text-zinc-600">— launch in seconds</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTemplateCategory(key)}
                    className={cn(
                      'rounded-lg px-3 py-1 text-xs font-medium transition-all',
                      templateCategory === key
                        ? 'bg-brand-600 text-white'
                        : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {filteredTemplates.map((template, i) => (
                <ScrollReveal key={template.id} delay={i * 40}>
                  <TemplateCard template={template} onUse={handleUseTemplate} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Search + filter */}
      <ScrollReveal delay={60}>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search flows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:ring-brand-500 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1">
            {(['all', 'active', 'draft', 'paused'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-all',
                  filter === f ? 'bg-brand-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' && flows.length > 0 && (
                  <span className="ml-1.5 text-xs text-zinc-600">{flows.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && flows.length === 0 && (
        <ScrollReveal>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-brand-500/10 animate-float mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
              <Sparkles className="text-brand-400 h-9 w-9" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-white">No flows yet</h3>
            <p className="mb-5 max-w-sm text-sm leading-relaxed text-zinc-500">
              Create your first automation in plain English, or start from a ready-made template.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700"
              >
                <Sparkles className="text-brand-400 h-4 w-4" /> Browse Templates
              </button>
              <button
                onClick={() => navigate({ to: '/flows/new' })}
                className="bg-brand-600 hover:bg-brand-500 shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-xl transition-all"
              >
                <Zap className="h-4 w-4" /> Build from Scratch
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* No results */}
      {!isLoading && flows.length > 0 && filteredFlows.length === 0 && (
        <ScrollReveal>
          <div className="flex flex-col items-center py-16 text-center">
            <XCircle className="mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">No flows match your filters</p>
            <button
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
              className="text-brand-400 hover:text-brand-300 mt-3 text-xs transition-colors"
            >
              Clear filters
            </button>
          </div>
        </ScrollReveal>
      )}

      {/* Flow list */}
      {!isLoading && filteredFlows.length > 0 && (
        <div className="space-y-3">
          {filteredFlows.map((flow, i) => (
            <ScrollReveal key={flow.id} delay={i * 50}>
              <FlowCard
                flow={flow}
                onView={() => navigate({ to: `/flows/${flow.id}` })}
                onActivate={() =>
                  updateMutation.mutate({ id: flow.id, data: { status: 'active' } })
                }
                onPause={() => updateMutation.mutate({ id: flow.id, data: { status: 'paused' } })}
                onDuplicate={() =>
                  createMutation.mutate({
                    name: `${flow.name} (Copy)`,
                    description: flow.description,
                    trigger: flow.trigger,
                    guardrails: flow.guardrails,
                    status: 'draft',
                  })
                }
                onDelete={() => setDeleteTarget({ id: flow.id, name: flow.name })}
              />
            </ScrollReveal>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          flowName={deleteTarget.name}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
