import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Play, Pause, Trash2, Share2, Bot, Zap, Clock, ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { SpotlightCard } from '../components/fx/SpotlightCard'
import { TextReveal } from '../components/fx/TextReveal'
import { cn } from '../lib/utils'

const STATUS_STYLES = {
  active: { dot: 'status-dot-active', cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20', label: 'Active' },
  draft:  { dot: 'status-dot',        cls: 'bg-zinc-700/50 text-zinc-300 ring-1 ring-zinc-600/30', label: 'Draft' },
  paused: { dot: 'status-dot-warning', cls: 'bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/20', label: 'Paused' },
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

  const { data: flows = [], isLoading, error } = useQuery({
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
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-center justify-between">
        <div>
          <TextReveal as="h1" className="heading-display text-white text-shimmer" stagger={50}>Flows</TextReveal>
          <p className="text-zinc-500 text-sm mt-1.5 text-pretty">
            Automate your sweepstakes casino routine with natural language
          </p>
        </div>
        <button
          onClick={handleCreateFlow}
          className="group flex items-center gap-2 px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-xl shadow-brand-500/20 press-scale"
        >
          <Plus className="w-4 h-4" />
          New Flow
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
      </ScrollReveal>

      {/* Filter Tabs */}
      <ScrollReveal delay={60}>
      <div className="flex gap-1 glass-card-static rounded-xl p-1 w-fit">

        {(['all', 'active', 'draft', 'paused'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === f
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]',
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
            <div key={i} className="glass-card rounded-2xl p-6 h-36 shimmer" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-card rounded-2xl p-4 border-red-500/20 bg-red-500/5 text-red-300 text-sm animate-spring-in flex items-start gap-2">
          <span className="text-red-400 mt-0.5">✕</span>
          <span>Failed to load flows. Please try again.</span>
        </div>
      )}

      {/* Flows List */}
      {(flows as any[]).length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-reveal-up">
          <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-5">
            <Sparkles className="w-9 h-9 text-brand-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No flows yet</h3>
          <p className="text-zinc-500 text-sm mb-7 max-w-sm text-pretty">
            Create your first automation to get started! Describe what you want in plain English.
          </p>
          <button
            onClick={handleCreateFlow}
            className="group flex items-center gap-2 px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-xl shadow-brand-500/20 press-scale"
          >
            <Zap className="w-4 h-4" />
            Create First Flow
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(flows as any[]).map((flow: any, i: number) => {
            const statusStyle = STATUS_STYLES[flow.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.draft
            return (
              <ScrollReveal key={flow.id} delay={i * 50}>
              <SpotlightCard
                className="glass-card rounded-2xl p-5 transition-all cursor-pointer"
                onClick={() => handleViewFlow(flow.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-base font-semibold text-white truncate">{flow.name}</h3>
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium', statusStyle.cls)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)} />
                        {statusStyle.label}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 line-clamp-1">{flow.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-xs text-zinc-600 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    <span className="tabular-nums">{flow.executionCount ?? 0}</span> executions
                  </div>
                  {flow.lastExecutedAt && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Last: {new Date(flow.lastExecutedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {flow.status === 'draft' || flow.status === 'paused' ? (
                    <button
                      onClick={() => handleActivateFlow(flow.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors press-scale"
                    >
                      <Play className="w-3 h-3" />
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePauseFlow(flow.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-300 text-xs font-medium hover:bg-yellow-500/20 transition-colors press-scale"
                    >
                      <Pause className="w-3 h-3" />
                      Pause
                    </button>
                  )}
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-400 text-xs font-medium hover:bg-white/[0.06] hover:text-zinc-300 transition-colors press-scale">
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-400/60 text-xs font-medium hover:bg-red-500/10 hover:text-red-400 transition-colors press-scale">
                    <Trash2 className="w-3 h-3" />
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
