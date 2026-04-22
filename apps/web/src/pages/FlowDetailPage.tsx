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
  TrendingUp,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { api } from '../lib/api'
import { cn, timeAgo } from '../lib/utils'
import { ScrollReveal } from '../components/fx/ScrollReveal'
import { FlowExecutionStatus } from '../components/FlowExecutionStatus'

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

function formatDurationHuman(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function FlowDetailPage() {
  const { flowId } = useParams({ from: '/app/flows/$flowId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

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
    await api.flows.update(flowId, { status: flow?.status === 'active' ? 'paused' : 'active' })
    queryClient.invalidateQueries({ queryKey: ['flows', flowId] })
  }

  const handleArchive = async () => {
    await api.flows.update(flowId, { status: 'archived' })
    navigate({ to: '/flows' })
  }

  if (flowLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
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
  const definition = f['definition'] as Record<string, unknown> | undefined
  const statusLabel =
    f.status === 'active'
      ? 'Active'
      : f.status === 'paused'
        ? 'Paused'
        : f.status === 'archived'
          ? 'Archived'
          : 'Unknown'
  const totalRuns = (f['executionCount'] as number) ?? 0
  const successfulRuns =
    executions && Array.isArray(executions)
      ? (executions as Record<string, unknown>[]).filter((e) => e['status'] === 'completed').length
      : 0
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      {/* Breadcrumb */}
      <ScrollReveal>
        <button
          onClick={() => navigate({ to: '/flows' })}
          className="mb-2 flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-300"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Flows
        </button>
      </ScrollReveal>

      {/* Header with Status and Actions */}
      <ScrollReveal delay={20}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-3">
              <h1 className="heading-display text-shimmer text-white">{f['name'] as string}</h1>
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                  f.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : f.status === 'paused'
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-zinc-700/50 text-zinc-400'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    f.status === 'active' ? 'animate-pulse bg-emerald-400' : 'bg-current'
                  )}
                />
                {statusLabel}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-pretty text-sm text-zinc-400">
              {f['description'] as string}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={handleExecute}
              className="btn-primary shadow-brand-500/20 press-scale group flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg"
            >
              <Play className="h-4 w-4" />
              Execute Now
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handlePause}
              className={cn(
                'press-scale flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                f.status === 'active'
                  ? 'bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              )}
            >
              {f.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              )}
            </button>
            <button
              onClick={() => setArchiveConfirm(true)}
              className="press-scale flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* Archive Confirmation Dialog */}
      {archiveConfirm && (
        <ScrollReveal delay={40}>
          <div className="glass-card-elevated rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <div className="flex-1">
                <h3 className="mb-1 font-semibold text-white">Archive this flow?</h3>
                <p className="mb-3 text-sm text-zinc-400">
                  This will stop all executions and archive the flow. You can restore it later.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleArchive}
                    className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => setArchiveConfirm(false)}
                    className="rounded-lg bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Execution Stats Cards */}
      <ScrollReveal delay={60}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Total Runs */}
          <div className="glass-card hover:border-brand-500/20 rounded-2xl border border-white/5 p-4 transition-colors">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total Runs
              </span>
              <Zap className="text-brand-400 h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-white">{totalRuns}</p>
            <p className="mt-1 text-xs text-zinc-500">Flow executions</p>
          </div>

          {/* Success Rate */}
          <div className="glass-card rounded-2xl border border-white/5 p-4 transition-colors hover:border-emerald-500/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Success Rate
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{successRate}%</p>
            <p className="mt-1 text-xs text-zinc-500">
              {successfulRuns} of {totalRuns} successful
            </p>
          </div>

          {/* Last Run */}
          <div className="glass-card rounded-2xl border border-white/5 p-4 transition-colors hover:border-blue-500/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Last Run
              </span>
              <Clock className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-white">
              {f['lastExecutedAt'] ? timeAgo(f['lastExecutedAt'] as string) : 'Never'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {f['lastExecutedAt']
                ? new Date(f['lastExecutedAt'] as string).toLocaleDateString()
                : 'No executions'}
            </p>
          </div>

          {/* Next Run */}
          <div className="glass-card rounded-2xl border border-white/5 p-4 transition-colors hover:border-yellow-500/20">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Next Run
              </span>
              <Clock className="h-4 w-4 text-yellow-400" />
            </div>
            <p className="text-sm font-semibold text-white">
              {f.status === 'active' ? 'Scheduled' : 'Inactive'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {f.status === 'active' ? 'Based on trigger' : 'Resume to schedule'}
            </p>
          </div>
        </div>
      </ScrollReveal>

      {/* Visual Flow Step Diagram */}
      {definition && (
        <ScrollReveal delay={80}>
          <div className="glass-card rounded-2xl p-6">
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-brand-500/10 flex h-8 w-8 items-center justify-center rounded-lg">
                <Bot className="text-brand-400 h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-300">Flow Steps</h2>
            </div>

            <div className="space-y-4">
              {Boolean(definition['trigger']) && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/15">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Trigger</p>
                    <p className="text-xs text-zinc-500">
                      {typeof definition['trigger'] === 'object'
                        ? String(
                            (definition['trigger'] as Record<string, unknown>)['type'] ??
                              'Schedule-based'
                          )
                        : 'Event trigger'}
                    </p>
                  </div>
                </div>
              )}

              {Boolean(definition['actions']) && Array.isArray(definition['actions']) && (
                <div className="flex items-center gap-3">
                  <div className="bg-brand-500/15 border-brand-500/30 flex h-10 w-10 items-center justify-center rounded-lg border">
                    <Zap className="text-brand-400 h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Actions</p>
                    <p className="text-xs text-zinc-500">
                      {(definition['actions'] as Record<string, unknown>[]).length} action(s)
                      configured
                    </p>
                  </div>
                </div>
              )}

              {Boolean(definition['guardrails']) && Array.isArray(definition['guardrails']) && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                    <Shield className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Guardrails</p>
                    <p className="text-xs text-zinc-500">
                      {(definition['guardrails'] as Record<string, unknown>[]).length} safeguard(s)
                      active
                    </p>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Complete</p>
                  <p className="text-xs text-zinc-500">Flow execution finished</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Live Execution Panel */}
      <ScrollReveal delay={120}>
        <div className="relative">
          {f.status === 'active' && (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="bg-brand-500 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-brand-500 relative inline-flex h-2 w-2 rounded-full" />
              </span>
              <span className="text-brand-400 text-xs font-semibold">Running</span>
            </div>
          )}
          <FlowExecutionStatus flowId={flowId} />
        </div>
      </ScrollReveal>

      {/* Guardrails Section */}
      {((f['guardrails'] as unknown[] | undefined)?.length ?? 0) > 0 && (
        <ScrollReveal delay={140}>
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Shield className="h-4 w-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-300">Safety Guards</h2>
            </div>
            <div className="space-y-2">
              {(f.guardrails as Record<string, unknown>[]).map((guard, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm text-zinc-300"
                >
                  <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-emerald-300">
                    {(guard['type'] as string) || `Guard ${idx + 1}`}:
                  </span>
                  <span className="tabular-nums text-zinc-400">{String(guard['value'])}</span>
                  {Boolean(guard['source']) && (
                    <span className="ml-auto text-xs text-zinc-600">
                      ({guard['source'] as string})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Execution History */}
      <ScrollReveal delay={160}>
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
                const duration = exec['duration'] as number | undefined
                return (
                  <div
                    key={exec['id'] as string}
                    className={cn(
                      'overflow-hidden rounded-xl border-l-4 transition-all hover:bg-white/[0.03]',
                      statusKey === 'completed'
                        ? 'border-l-emerald-500 bg-emerald-500/[0.01]'
                        : statusKey === 'failed'
                          ? 'border-l-red-500 bg-red-500/[0.01]'
                          : statusKey === 'running'
                            ? 'border-l-brand-500 bg-brand-500/[0.01]'
                            : 'border-l-yellow-500 bg-yellow-500/[0.01]'
                    )}
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
                        <StIcon className={cn('h-5 w-5', st.cls)} />
                        <div>
                          <span className="text-sm font-medium text-white">{st.label}</span>
                          <span className="ml-2 text-xs tabular-nums text-zinc-600">
                            {new Date(exec['startedAt'] as string).toLocaleString()}
                            {duration && ` · ${formatDurationHuman(duration)}`}
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
                        {Boolean(exec['metrics']) && (
                          <div className="grid grid-cols-3 gap-2">
                            {(() => {
                              const m = exec['metrics'] as Record<string, unknown>
                              return [
                                ['Actions', m['actionsExecuted']],
                                ['Spins', m['spinsExecuted']],
                                ['Bonuses', m['bonusesClaimed']],
                                [
                                  'Bonus Value',
                                  `$${((m['bonusValueClaimed'] as number | null) ?? 0).toFixed(2)}`,
                                ],
                                [
                                  'Wagered',
                                  `$${((m['totalWagered'] as number | null) ?? 0).toFixed(2)}`,
                                ],
                                ['Won', `$${((m['totalWon'] as number | null) ?? 0).toFixed(2)}`],
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
                                  <span className="text-zinc-600">
                                    [{(log['type'] as string).toUpperCase()}]
                                  </span>{' '}
                                  {((log['details'] as Record<string, unknown> | null)?.[
                                    'message'
                                  ] as string) || JSON.stringify(log['details']).substring(0, 100)}
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
