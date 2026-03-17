import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  Play,
  Pause,
  Archive,
  ChevronDown,
  Bot,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  ArrowRight,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { TextReveal } from '../components/fx/TextReveal'

const EXEC_STATUS = {
  completed: {
    icon: CheckCircle2,
    cls: 'text-emerald-400',
    dot: 'status-dot-active',
    label: 'Completed',
  },
  failed: { icon: XCircle, cls: 'text-red-400', dot: 'status-dot-danger', label: 'Failed' },
  running: {
    icon: Loader2,
    cls: 'text-brand-400 animate-spin',
    dot: 'status-dot-active',
    label: 'Running',
  },
  pending: { icon: Clock, cls: 'text-yellow-400', dot: 'status-dot-warning', label: 'Pending' },
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
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <div className="skeleton-text h-10 w-64 rounded-lg" />
        <div className="glass-card shimmer h-48 rounded-2xl" />
        <div className="glass-card shimmer h-64 rounded-2xl" />
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="animate-reveal-up flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="empty-icon-wrapper mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10">
          <XCircle className="h-9 w-9 text-red-400" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Flow not found</h2>
        <p className="text-pretty text-sm text-zinc-500">
          This flow may have been deleted or is no longer accessible.
        </p>
      </div>
    )
  }

  const f = flow as Record<string, unknown>

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
      {/* Header */}
      <ScrollReveal>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="heading-display text-shimmer text-white">{f['name'] as string}</h1>
            <p className="mt-1.5 text-pretty text-sm text-zinc-500">{f['description'] as string}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    f.status === 'active'
                      ? 'status-dot-active'
                      : f.status === 'paused'
                        ? 'status-dot-warning'
                        : 'bg-zinc-600'
                  )}
                />
                {(f['status'] as string)?.charAt(0).toUpperCase() +
                  (f['status'] as string)?.slice(1)}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Zap className="h-3 w-3" />
                {(f['executionCount'] as number) ?? 0} executions
              </span>
              {!!f['lastExecutedAt'] && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="h-3 w-3" />
                  Last: {new Date(f['lastExecutedAt'] as string).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {f.status !== 'active' && (
              <button
                onClick={handleExecute}
                className="btn-primary shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg"
              >
                <Play className="h-4 w-4" />
                Execute Now
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            {f.status === 'active' && (
              <button
                onClick={handlePause}
                className="press-scale flex items-center gap-2 rounded-xl bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-300 transition-colors hover:bg-yellow-500/20"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
            )}
            <button
              onClick={handleArchive}
              className="press-scale flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* Flow Definition */}
      <ScrollReveal delay={60}>
        <div className="glass-card rounded-2xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-brand-500/10 flex h-7 w-7 items-center justify-center rounded-lg">
              <Bot className="text-brand-400 h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-zinc-300">Flow Definition</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-zinc-950/60 p-4 font-mono text-xs text-zinc-400">
            <pre className="leading-relaxed">{JSON.stringify(f.definition, null, 2)}</pre>
          </div>
        </div>
      </ScrollReveal>

      {/* Guardrails */}
      {!!(f['guardrails'] as unknown[] | undefined)?.length && (
        <ScrollReveal delay={120}>
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="bg-brand-500/10 flex h-7 w-7 items-center justify-center rounded-lg">
                <Shield className="text-brand-400 h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-300">Safety Guards</h2>
            </div>
            <div className="space-y-2">
              {(f.guardrails as Record<string, unknown>[]).map((guard, idx) => (
                <div
                  key={idx}
                  className="bg-brand-500/5 border-brand-500/10 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-zinc-400"
                >
                  <span className="text-brand-300 font-semibold">{guard['type'] as string}:</span>
                  <span className="tabular-nums">{String(guard['value'])}</span>
                  <span className="ml-auto text-xs text-zinc-600">
                    ({guard['source'] as string})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Execution History */}
      <ScrollReveal delay={180}>
        <div className="glass-card rounded-2xl p-5">
          <h2 className="mb-4 text-sm font-bold tracking-tight text-zinc-300">Execution History</h2>

          {execLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="shimmer h-16 rounded-xl bg-zinc-800/30" />
              ))}
            </div>
          ) : !executions || (executions as Record<string, unknown>[]).length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center py-14 text-center">
              <div className="empty-icon-wrapper mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/50">
                <Clock className="h-6 w-6 text-zinc-600" />
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
                    className="overflow-hidden rounded-xl border border-white/[0.04] bg-white/[0.02] transition-all hover:bg-white/[0.03]"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between p-4"
                      onClick={() =>
                        setExpandedExecution(
                          expandedExecution === exec['id'] ? null : (exec['id'] as string)
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <StIcon className={cn('h-4 w-4', st.cls)} />
                        <div>
                          <span className="text-sm font-medium text-white">{st.label}</span>
                          <span className="ml-2 text-xs tabular-nums text-zinc-600">
                            {new Date(exec['startedAt'] as string).toLocaleString()}
                            {!!exec['duration'] &&
                              ` · ${((exec['duration'] as number) / 1000).toFixed(1)}s`}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-zinc-600 transition-transform duration-200',
                          expandedExecution === exec['id'] && 'rotate-180'
                        )}
                      />
                    </div>

                    {expandedExecution === exec['id'] && (
                      <div className="animate-slide-up-fade space-y-3 border-t border-white/[0.04] px-4 pb-4 pt-3">
                        {!!exec['metrics'] && (
                          <div className="grid grid-cols-3 gap-2">
                            {(() => {
                              const m = exec['metrics'] as Record<string, unknown>
                              return [
                                ['Actions', m['actionsExecuted']],
                                ['Spins', m['spinsExecuted']],
                                ['Bonuses', m['bonusesClaimed']],
                                [
                                  'Bonus Value',
                                  `$${(m['bonusValueClaimed'] as number | null)?.toFixed(2) ?? '0'}`,
                                ],
                                [
                                  'Wagered',
                                  `$${(m['totalWagered'] as number | null)?.toFixed(2) ?? '0'}`,
                                ],
                                ['Won', `$${(m['totalWon'] as number | null)?.toFixed(2) ?? '0'}`],
                              ].map(([label, val]) => (
                                <div
                                  key={label as string}
                                  className="rounded-xl border border-white/[0.03] bg-white/[0.02] p-2.5"
                                >
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                                    {label as string}
                                  </p>
                                  <p className="mt-0.5 text-xs font-bold tabular-nums text-zinc-300">
                                    {val as string}
                                  </p>
                                </div>
                              ))
                            })()}
                          </div>
                        )}

                        {(exec['log'] as unknown[] | undefined)?.length ? (
                          <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.03] bg-zinc-950/60 p-3">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                              Log
                            </p>
                            {(exec['log'] as Record<string, unknown>[])
                              .slice(-10)
                              .map((log, idx) => (
                                <div
                                  key={idx}
                                  className="mb-1 font-mono text-[11px] leading-relaxed text-zinc-500"
                                >
                                  <span className="text-zinc-600">[{log['type'] as string}]</span>{' '}
                                  {((log['details'] as Record<string, unknown> | null)?.[
                                    'message'
                                  ] as string | undefined) ??
                                    JSON.stringify(log['details']).substring(0, 100)}
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
