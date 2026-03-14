import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/utils'
import { SpotlightCard } from './fx/SpotlightCard'

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowExecution = {
  id: string
  flow_id: string
  status: 'running' | 'completed' | 'failed' | 'stopped_by_guardrail'
  started_at: string
  completed_at?: string
  metrics: {
    totalDuration: number
    actionsExecuted: number
    conditionsEvaluated: number
    loopIterations: number
    bonusesClaimed: number
    spinsExecuted: number
    totalWagered: number
    totalWon: number
    netResult: number
  }
  log: Array<{
    timestamp: string
    level: 'info' | 'warn' | 'error'
    message: string
    context?: Record<string, unknown>
  }>
  error_details?: string
}

type FlowExecutionStatusProps = {
  flowId: string
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlowExecutionStatus({ flowId, className }: FlowExecutionStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const queryClient = useQueryClient()

  // Get current execution status
  const { data: execution, isLoading } = useQuery({
    queryKey: ['flows', flowId, 'execution'],
    queryFn: () => api.flows.getCurrentExecution(flowId),
    refetchInterval: (query) => {
      // Poll every 2s if running, stop if completed/failed
      const data = query.state.data as FlowExecution | undefined
      return data?.status === 'running' ? 2000 : false
    },
  })

  // Manual execution trigger
  const executeMutation = useMutation({
    mutationFn: () => api.flows.execute(flowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'execution'] })
    },
  })

  // Cancel execution
  const cancelMutation = useMutation({
    mutationFn: () => api.flows.cancelExecution(flowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows', flowId, 'execution'] })
    },
  })

  if (isLoading) {
    return <FlowExecutionSkeleton className={className} />
  }

  const exec = execution as FlowExecution | null
  const isRunning = exec?.status === 'running'
  const canExecute = !isRunning && !executeMutation.isPending

  return (
    <SpotlightCard className={cn('glass-card rounded-2xl p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIcon status={exec?.status} />
          <h3 className="text-sm font-semibold text-white">
            {isRunning ? 'Flow Running' : exec ? 'Last Execution' : 'Ready to Execute'}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {exec?.log && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg glass-card-static text-zinc-400 hover:text-white transition-colors"
              title={isExpanded ? 'Hide logs' : 'Show logs'}
            >
              {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          
          {isRunning ? (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              onClick={() => executeMutation.mutate()}
              disabled={!canExecute}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Execute
            </button>
          )}
        </div>
      </div>

      {/* Status Details */}
      {exec && (
        <div className="space-y-3">
          {/* Timing */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              {isRunning ? 'Started' : 'Completed'}
            </span>
            <span className="text-white font-medium">
              {new Date(exec.started_at).toLocaleString()}
            </span>
          </div>

          {/* Duration */}
          {exec.metrics && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Duration</span>
              <span className="text-white font-medium">
                {formatDuration(exec.metrics.totalDuration)}
              </span>
            </div>
          )}

          {/* Key Metrics */}
          {exec.metrics && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.04]">
              <MetricItem 
                label="Actions" 
                value={exec.metrics.actionsExecuted} 
                icon={<Zap className="w-3 h-3" />}
              />
              <MetricItem 
                label="Spins" 
                value={exec.metrics.spinsExecuted} 
                icon={<Activity className="w-3 h-3" />}
              />
              <MetricItem 
                label="Bonuses" 
                value={exec.metrics.bonusesClaimed} 
                icon={<CheckCircle className="w-3 h-3" />}
              />
              <MetricItem 
                label="Net Result" 
                value={`${exec.metrics.netResult >= 0 ? '+' : ''}${exec.metrics.netResult.toFixed(2)} SC`}
                valueClass={exec.metrics.netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}
              />
            </div>
          )}

          {/* Error Details */}
          {exec.error_details && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-red-400 text-sm font-medium mb-1">Error</p>
              <p className="text-red-300 text-xs">{exec.error_details}</p>
            </div>
          )}

          {/* Execution Log */}
          {isExpanded && exec.log && exec.log.length > 0 && (
            <div className="pt-3 border-t border-white/[0.04]">
              <p className="text-zinc-400 text-xs font-medium mb-2 uppercase tracking-wider">
                Execution Log
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {exec.log.map((entry, i) => (
                  <LogEntry key={i} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No execution state */}
      {!exec && (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-3">
            <Play className="w-5 h-5 text-brand-400" />
          </div>
          <p className="text-zinc-500 text-sm">
            This flow hasn't been executed yet.
          </p>
        </div>
      )}
    </SpotlightCard>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'running':
      return <Activity className="w-4 h-4 text-brand-400 animate-pulse" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />
    case 'stopped_by_guardrail':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    default:
      return <Clock className="w-4 h-4 text-zinc-500" />
  }
}

function MetricItem({ 
  label, 
  value, 
  icon, 
  valueClass = 'text-white' 
}: { 
  label: string
  value: string | number
  icon?: React.ReactNode
  valueClass?: string 
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <span className="text-zinc-500 text-xs">{label}</span>
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', valueClass)}>
        {value}
      </span>
    </div>
  )
}

function LogEntry({ entry }: { entry: FlowExecution['log'][0] }) {
  const levelColors = {
    info: 'text-zinc-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
  }

  return (
    <div className="flex gap-2 text-xs">
      <span className="text-zinc-600 tabular-nums shrink-0">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
      <span className={cn('font-medium shrink-0', levelColors[entry.level])}>
        {entry.level.toUpperCase()}
      </span>
      <span className="text-zinc-300">{entry.message}</span>
    </div>
  )
}

function FlowExecutionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('glass-card rounded-2xl p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-zinc-700 rounded shimmer" />
          <div className="h-4 w-24 bg-zinc-700 rounded shimmer" />
        </div>
        <div className="h-8 w-20 bg-zinc-700 rounded-lg shimmer" />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-zinc-800 rounded shimmer" />
          <div className="h-3 w-32 bg-zinc-800 rounded shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 bg-zinc-800/50 rounded shimmer" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}