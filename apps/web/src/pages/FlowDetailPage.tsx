import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import { Play, Pause, Archive, ChevronDown, Bot, Clock, Zap, CheckCircle2, XCircle, Loader2, Shield, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'

const EXEC_STATUS = {
  completed: { icon: CheckCircle2, cls: 'text-emerald-400', dot: 'status-dot-active', label: 'Completed' },
  failed:    { icon: XCircle,      cls: 'text-red-400',     dot: 'status-dot-danger', label: 'Failed' },
  running:   { icon: Loader2,      cls: 'text-brand-400 animate-spin', dot: 'status-dot-active', label: 'Running' },
  pending:   { icon: Clock,        cls: 'text-yellow-400',  dot: 'status-dot-warning', label: 'Pending' },
} as const

/**
 * Render the detail page for a single flow, showing its metadata, definition, safety guards, and execution history.
 *
 * Fetches flow metadata and execution history, and provides actions to execute, pause, or archive the flow. Archiving
 * the flow navigates back to the flows list.
 *
 * @returns The React element for the flow detail page.
 */
export function FlowDetailPage() {
  const { flowId } = useParams({ from: '/app/flows/$flowId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null)

  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ['flows', flowId],
    queryFn: () => api.flows.get(flowId),
  })

  const { data: executions, isLoading: execLoading } = useQuery({
    queryKey: ['flows', flowId, 'executions'],
    queryFn: () => api.flows.executions(flowId),
  })

  const handleExecute = async () => {
    await api.flows.execute(flowId)
    queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'executions'] })
  }

  const handlePause = async () => {
    await api.flows.update(flowId, { status: 'paused' })
    queryClient.invalidateQueries({ queryKey: ['flows', flowId] })
  }

  const handleArchive = async () => {
    await api.flows.update(flowId, { status: 'archived' })
    navigate({ to: '/flows' })
  }

  if (flowLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="h-10 w-64 skeleton-text rounded-lg" />
        <div className="glass-card rounded-2xl h-48 shimmer" />
        <div className="glass-card rounded-2xl h-64 shimmer" />
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center animate-reveal-up">
        <div className="empty-icon-wrapper w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
          <XCircle className="w-9 h-9 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Flow not found</h2>
        <p className="text-zinc-500 text-sm text-pretty">This flow may have been deleted or is no longer accessible.</p>
      </div>
    )
  }

  const f = flow as Record<string, unknown>

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <ScrollReveal>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-display text-white text-shimmer">{f['name'] as string}</h1>
          <p className="text-zinc-500 text-sm mt-1.5 text-pretty">{f['description'] as string}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className={cn(
                'w-2 h-2 rounded-full',
                f.status === 'active' ? 'status-dot-active' : f.status === 'paused' ? 'status-dot-warning' : 'bg-zinc-600'
              )} />
              {(f['status'] as string)?.charAt(0).toUpperCase() + (f['status'] as string)?.slice(1)}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <Zap className="w-3 h-3" />
              {(f['executionCount'] as number) ?? 0} executions
            </span>
            {!!(f['lastExecutedAt']) && (
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />
                Last: {new Date(f['lastExecutedAt'] as string).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {f.status !== 'active' && (
            <button
              onClick={handleExecute}
              className="group flex items-center gap-2 px-4 py-2 btn-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 press-scale"
            >
              <Play className="w-4 h-4" />
              Execute Now
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          {f.status === 'active' && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-300 text-sm font-medium hover:bg-yellow-500/20 transition-colors press-scale"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors press-scale"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>
      </div>
      </ScrollReveal>

      {/* Flow Definition */}
      <ScrollReveal delay={60}>
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <h2 className="text-sm font-bold text-zinc-300 tracking-tight">Flow Definition</h2>
        </div>
        <div className="bg-zinc-950/60 rounded-xl p-4 font-mono text-xs text-zinc-400 overflow-x-auto border border-white/[0.04]">
          <pre className="leading-relaxed">{JSON.stringify(f.definition, null, 2)}</pre>
        </div>
      </div>
      </ScrollReveal>

      {/* Guardrails */}
      {!!(f['guardrails'] as unknown[] | undefined)?.length && (
        <ScrollReveal delay={120}>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-brand-400" />
            </div>
            <h2 className="text-sm font-bold text-zinc-300 tracking-tight">Safety Guards</h2>
          </div>
          <div className="space-y-2">
            {(f.guardrails as Record<string, unknown>[]).map((guard, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-zinc-400 bg-brand-500/5 rounded-xl px-4 py-2.5 border border-brand-500/10">
                <span className="text-brand-300 font-semibold">{guard['type'] as string}:</span>
                <span className="tabular-nums">{String(guard['value'])}</span>
                <span className="text-zinc-600 ml-auto text-xs">({guard['source'] as string})</span>
              </div>
            ))}
          </div>
        </div>
        </ScrollReveal>
      )}

      {/* Execution History */}
      <ScrollReveal delay={180}>
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-zinc-300 mb-4 tracking-tight">Execution History</h2>

        {execLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-zinc-800/30 rounded-xl shimmer" />
            ))}
          </div>
        ) : !executions || (executions as Record<string, unknown>[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
            <div className="empty-icon-wrapper w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No executions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(executions as Record<string, unknown>[]).map((exec) => {
              const statusKey = exec['status'] as keyof typeof EXEC_STATUS
              const st = EXEC_STATUS[statusKey] ?? EXEC_STATUS.pending
              const StIcon = st.icon
              return (
                <div
                  key={exec['id'] as string}
                  className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden hover:bg-white/[0.03] transition-all"
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpandedExecution(expandedExecution === exec['id'] ? null : exec['id'] as string)}
                  >
                    <div className="flex items-center gap-3">
                      <StIcon className={cn('w-4 h-4', st.cls)} />
                      <div>
                        <span className="text-sm font-medium text-white">{st.label}</span>
                        <span className="text-xs text-zinc-600 ml-2 tabular-nums">
                          {new Date(exec['startedAt'] as string).toLocaleString()}
                          {!!exec['duration'] && ` · ${((exec['duration'] as number) / 1000).toFixed(1)}s`}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn('w-4 h-4 text-zinc-600 transition-transform duration-200', expandedExecution === exec['id'] && 'rotate-180')}
                    />
                  </div>

                  {expandedExecution === exec['id'] && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3 animate-slide-up-fade">
                      {!!exec['metrics'] && (
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            const m = exec['metrics'] as Record<string, unknown>
                            return [
                              ['Actions', m['actionsExecuted']],
                              ['Spins', m['spinsExecuted']],
                              ['Bonuses', m['bonusesClaimed']],
                              ['Bonus Value', `$${(m['bonusValueClaimed'] as number | null)?.toFixed(2) ?? '0'}`],
                              ['Wagered', `$${(m['totalWagered'] as number | null)?.toFixed(2) ?? '0'}`],
                              ['Won', `$${(m['totalWon'] as number | null)?.toFixed(2) ?? '0'}`],
                            ].map(([label, val]) => (
                              <div key={label as string} className="bg-white/[0.02] rounded-xl p-2.5 border border-white/[0.03]">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold">{label as string}</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums mt-0.5">{val as string}</p>
                              </div>
                            ))
                          })()}
                        </div>
                      )}

                      {(exec['log'] as unknown[] | undefined)?.length ? (
                        <div className="bg-zinc-950/60 rounded-xl p-3 max-h-48 overflow-y-auto border border-white/[0.03]">
                          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-2">Log</p>
                          {(exec['log'] as Record<string, unknown>[]).slice(-10).map((log, idx) => (
                            <div key={idx} className="text-[11px] text-zinc-500 mb-1 font-mono leading-relaxed">
                              <span className="text-zinc-600">[{log['type'] as string}]</span>{' '}
                              {(log['details'] as Record<string, unknown> | null)?.['message'] as string | undefined ?? JSON.stringify(log['details']).substring(0, 100)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      </ScrollReveal>
    </div>
  )
}
