import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
} from 'lucide-react'
import { api } from '../lib/api'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'
import { cn } from '../lib/utils'

const STATUS_STYLES = {
  active: {
    dot: 'status-dot-active',
    cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20',
    label: 'Active',
  },
  draft: {
    dot: 'status-dot',
    cls: 'bg-zinc-700/50 text-zinc-300 ring-1 ring-zinc-600/30',
    label: 'Draft',
  },
  paused: {
    dot: 'status-dot-warning',
    cls: 'bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/20',
    label: 'Paused',
  },
} as const

/**
 * Page component that displays and manages the current user's automation flows.
 *
 * Renders a header with creation control, filter tabs, a list of flows with status and metadata,
 * and per-flow actions (view, activate, pause, share, delete). Handles navigation and status updates.
 *
 * @returns The React element for the Flows page UI
 */
export function FlowsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'paused'>('all')

  const {
    data: flows = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['flows', { filter, page: 1 }],
    queryFn: () => api.flows.list({ page: 1, pageSize: 50 }),
  })

  const handleCreateFlow = () => navigate({ to: '/flows/new' })
  const handleViewFlow = (flowId: string) => navigate({ to: `/flows/${flowId}` })

  const handleActivateFlow = async (flowId: string) => {
    await api.flows.update(flowId, { status: 'active' })
    queryClient.invalidateQueries({ queryKey: ['flows'] })
  }

  const handlePauseFlow = async (flowId: string) => {
    await api.flows.update(flowId, { status: 'paused' })
    queryClient.invalidateQueries({ queryKey: ['flows'] })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex items-center justify-between">
          <div>
            <TextReveal as="h1" className="heading-display text-shimmer text-white" stagger={50}>
              Flows
            </TextReveal>
            <p className="mt-1.5 text-pretty text-sm text-zinc-500">
              Automate your sweepstakes casino routine with natural language
            </p>
          </div>
          <button
            onClick={handleCreateFlow}
            className="btn-primary shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-xl"
          >
            <Plus className="h-4 w-4" />
            New Flow
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </ScrollReveal>

      {/* Filter Tabs */}
      <ScrollReveal delay={60}>
        <div className="glass-card-static flex w-fit gap-1 rounded-xl p-1">
          {(['all', 'active', 'draft', 'paused'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                filter === f
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card shimmer h-36 rounded-2xl p-6" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-card animate-spring-in flex items-start gap-2 rounded-2xl border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          <span className="mt-0.5 text-red-400">✕</span>
          <span>Failed to load flows. Please try again.</span>
        </div>
      )}

      {/* Flows List */}
      {(flows as Record<string, unknown>[]).length === 0 && !isLoading ? (
        <div className="animate-reveal-up flex flex-col items-center justify-center py-24 text-center">
          <div className="empty-icon-wrapper bg-brand-500/10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
            <Sparkles className="text-brand-400 h-9 w-9" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-white">No flows yet</h3>
          <p className="mb-7 max-w-sm text-pretty text-sm text-zinc-500">
            Create your first automation to get started! Describe what you want in plain English.
          </p>
          <button
            onClick={handleCreateFlow}
            className="btn-primary shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-xl"
          >
            <Zap className="h-4 w-4" />
            Create First Flow
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(flows as Record<string, unknown>[]).map((flow, i) => {
            const statusStyle =
              STATUS_STYLES[flow['status'] as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.draft
            return (
              <ScrollReveal key={flow['id'] as string} delay={i * 50}>
                <SpotlightCard
                  className="glass-card cursor-pointer rounded-2xl p-5 transition-all"
                  onClick={() => handleViewFlow(flow['id'] as string)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2.5">
                        <h3 className="truncate text-base font-semibold text-white">
                          {flow['name'] as string}
                        </h3>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium',
                            statusStyle.cls
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-sm text-zinc-500">
                        {flow['description'] as string}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center gap-5 text-xs text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3" />
                      <span className="tabular-nums">
                        {(flow['executionCount'] as number) ?? 0}
                      </span>{' '}
                      executions
                    </div>
                    {!!flow['lastExecutedAt'] && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Last: {new Date(flow['lastExecutedAt'] as string).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {flow['status'] === 'draft' || flow['status'] === 'paused' ? (
                      <button
                        onClick={() => handleActivateFlow(flow['id'] as string)}
                        className="press-scale flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                      >
                        <Play className="h-3 w-3" />
                        Activate
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePauseFlow(flow['id'] as string)}
                        className="press-scale flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-500/20"
                      >
                        <Pause className="h-3 w-3" />
                        Pause
                      </button>
                    )}
                    <button className="press-scale flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-300">
                      <Share2 className="h-3 w-3" />
                      Share
                    </button>
                    <button className="press-scale flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </SpotlightCard>
              </ScrollReveal>
            )
          })}
        </div>
      )}
    </div>
  )
}
