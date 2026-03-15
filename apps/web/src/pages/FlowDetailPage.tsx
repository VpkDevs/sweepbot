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
import { TextReveal } from '../components/fx/TextReveal'
import { FlowExecutionStatus } from '../components/FlowExecutionStatus'

const EXEC_STATUS = {
  completed: { icon: CheckCircle2, cls: 'text-emerald-400', dot: 'status-dot-active', label: 'Completed' },
  failed: { icon: XCircle, cls: 'text-red-400', dot: 'status-dot-danger', label: 'Failed' },
  running: { icon: Loader2, cls: 'text-brand-400 animate-spin', dot: 'status-dot-active', label: 'Running' },
  pending: { icon: Clock, cls: 'text-yellow-400', dot: 'status-dot-warning', label: 'Pending' },
} as const

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trigger: Clock,
  action: Zap,
  guardrail: Shield,
  complete: CheckCircle2,
}

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
    navigate({ to: '/app/flows' })
  }

  if (flowLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
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
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <ScrollReveal>
        <button
          onClick={() => navigate({ to: '/app/flows' })}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Flows
        </button>
      </ScrollReveal>

      {/* Header with Status and Actions */}
      <ScrollReveal delay={20}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="heading-display text-white text-shimmer">{f['name'] as string}</h1>
              <span
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5',
                  f.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : f.status === 'paused'
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-zinc-700/50 text-zinc-400'
                )}
              >
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  f.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                )} />
                {statusLabel}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1.5 text-pretty max-w-2xl">{f['description'] as string}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleExecute}
              className="group flex items-center gap-2 px-4 py-2 btn-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-500/20 press-scale"
            >
              <Play className="w-4 h-4" />
              Execute Now
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={handlePause}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors press-scale',
                f.status === 'active'
                  ? 'bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              )}
            >
              {f.status === 'active' ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              )}
            </button>
            <button
              onClick={() => setArchiveConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors press-scale"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
          </div>
        </div>
      </ScrollReveal>

      {/* Archive Confirmation Dialog */}
      {archiveConfirm && (
        <ScrollReveal delay={40}>
          <div className="glass-card-elevated rounded-2xl p-5 border border-red-500/20 bg-red-500/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">Archive this flow?</h3>
                <p className="text-sm text-zinc-400 mb-3">This will stop all executions and archive the flow. You can restore it later.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleArchive}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => setArchiveConfirm(false)}
                    className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.06] text-zinc-300 rounded-lg text-sm font-medium transition-colors"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Runs */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 hover:border-brand-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Runs</span>
              <Zap className="w-4 h-4 text-brand-400" />
            </div>
            <p className="text-2xl font-bold text-white">{totalRuns}</p>
            <p className="text-xs text-zinc-500 mt-1">Flow executions</p>
          </div>

          {/* Success Rate */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 hover:border-emerald-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Success Rate</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">{successRate}%</p>
            <p className="text-xs text-zinc-500 mt-1">
              {successfulRuns} of {totalRuns} successful
            </p>
          </div>

          {/* Last Run */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 hover:border-blue-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Run</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-white">
              {f['lastExecutedAt'] ? timeAgo(f['lastExecutedAt'] as string) : 'Never'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {f['lastExecutedAt'] ? new Date(f['lastExecutedAt'] as string).toLocaleDateString() : 'No executions'}
            </p>
          </div>

          {/* Next Run */}
          <div className="glass-card rounded-2xl p-4 border border-white/5 hover:border-yellow-500/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Next Run</span>
              <Clock className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-sm font-semibold text-white">
              {f.status === 'active' ? 'Scheduled' : 'Inactive'}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {f.status === 'active' ? 'Based on trigger' : 'Resume to schedule'}
            </p>
          </div>
        </div>
      </ScrollReveal>

      {/* Visual Flow Step Diagram */}
      {definition && (
        <ScrollReveal delay={80}>
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-brand-400" />
              </div>
              <h2 className="text-sm font-bold text-zinc-300 tracking-tight">Flow Steps</h2>
            </div>

            <div className="space-y-4">
              {/* Trigger Step */}
              {definition['trigger'] && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30">
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Trigger</p>
                    <p className="text-xs text-zinc-500">
                      {typeof definition['trigger'] === 'object'
                        ? (definition['trigger'] as Record<string, unknown>)['type'] || 'Schedule-based'
                        : 'Event trigger'}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions Step */}
              {definition['actions'] && Array.isArray(definition['actions']) && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-500/15 border border-brand-500/30">
                    <Zap className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Actions</p>
                    <p className="text-xs text-zinc-500">
                      {(definition['actions'] as Record<string, unknown>[]).length} action(s) configured
                    </p>
                  </div>
                </div>
              )}

              {/* Guardrails Step */}
              {definition['guardrails'] && Array.isArray(definition['guardrails']) && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Guardrails</p>
                    <p className="text-xs text-zinc-500">
                      {(definition['guardrails'] as Record<string, unknown>[]).length} safeguard(s) active
                    </p>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
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
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
              <span className="text-xs font-semibold text-brand-400">Running</span>
            </div>
          )}
          <FlowExecutionStatus flowId={flowId} />
        </div>
      </ScrollReveal>

      {/* Guardrails Section */}
      {((f['guardrails'] as unknown[] | undefined)?.length ?? 0) > 0 && (
        <ScrollReveal delay={140}>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm font-bold text-zinc-300 tracking-tight">Safety Guards</h2>
            </div>
            <div className="space-y-2">
              {(f.guardrails as Record<string, unknown>[]).map((guard, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-sm text-zinc-300 bg-emerald-500/5 rounded-xl px-4 py-3 border border-emerald-500/15"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="font-semibold text-emerald-300">{(guard['type'] as string) || `Guard ${idx + 1}`}:</span>
                  <span className="tabular-nums text-zinc-400">{String(guard['value'])}</span>
                  {guard['source'] && (
                    <span className="text-xs text-zinc-600 ml-auto">({guard['source'] as string})</span>
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
                const duration = exec['duration'] as number | undefined
                return (
                  <div
                    key={exec['id'] as string}
                    className={cn(
                      'rounded-xl overflow-hidden hover:bg-white/[0.03] transition-all border-l-4',
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
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedExecution(expandedExecution === exec['id'] ? null : exec['id'] as string)}
                    >
                      <div className="flex items-center gap-3">
                        <StIcon className={cn('w-5 h-5', st.cls)} />
                        <div>
                          <span className="text-sm font-medium text-white">{st.label}</span>
                          <span className="text-xs text-zinc-600 ml-2 tabular-nums">
                            {new Date(exec['startedAt'] as string).toLocaleString()}
                            {duration && ` · ${formatDurationHuman(duration)}`}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-zinc-600 transition-transform duration-200',
                          expandedExecution === exec['id'] && 'rotate-180'
                        )}
                      />
                    </div>

                    {expandedExecution === exec['id'] && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3 animate-slide-up-fade">
                        {exec['metrics'] && (
                          <div className="grid grid-cols-3 gap-2">
                            {(() => {
                              const m = exec['metrics'] as Record<string, unknown>
                              return [
                                ['Actions', m['actionsExecuted']],
                                ['Spins', m['spinsExecuted']],
                                ['Bonuses', m['bonusesClaimed']],
                                ['Bonus Value', `$${((m['bonusValueClaimed'] as number | null) ?? 0).toFixed(2)}`],
                                ['Wagered', `$${((m['totalWagered'] as number | null) ?? 0).toFixed(2)}`],
                                ['Won', `$${((m['totalWon'] as number | null) ?? 0).toFixed(2)}`],
                              ].map(([label, val]) => (
                                <div key={label as string} className="bg-white/[0.02] rounded-xl p-2.5 border border-white/[0.03]">
                                  <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold">
                                    {label as string}
                                  </p>
                                  <p className="text-xs font-bold text-zinc-300 tabular-nums mt-0.5">{val as string}</p>
                                </div>
                              ))
                            })()}
                          </div>
                        )}

                        {(exec['log'] as unknown[] | undefined)?.length ? (
                          <div className="bg-zinc-950/60 rounded-xl p-3 max-h-48 overflow-y-auto border border-white/[0.03]">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-semibold mb-2">
                              Log
                            </p>
                            {(exec['log'] as Record<string, unknown>[]).slice(-10).map((log, idx) => (
                              <div key={idx} className="text-[11px] text-zinc-500 mb-1 font-mono leading-relaxed">
                                <span className="text-zinc-600">[{(log['type'] as string).toUpperCase()}]</span>{' '}
                                {((log['details'] as Record<string, unknown> | null)?.['message'] as string) ||
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
