/**
 * Flow Detail Page - View and manage a single Flow
 * Shows flow definition, execution history, and performance stats
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from '@tanstack/react-router'
import { Play, Pause, Archive, ChevronDown } from 'lucide-react'
import { api } from '../lib/api'

/**
 * Render the detail page for a single flow, showing its metadata, definition, safety guards, and execution history.
 *
 * Fetches flow metadata and execution history, and provides actions to execute, pause, or archive the flow. Archiving
 * the flow navigates back to the flows list.
 *
 * @returns The React element for the flow detail page.
 */
export function FlowDetailPage() {
  const { flowId } = useParams({ from: '/flows/$flowId' })
  const navigate = useNavigate()
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null)

  // Fetch flow details
  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ['flows', flowId],
    queryFn: async () => {
      const response = await api.get(`/flows/${flowId}`)
      return response.data.data
    },
  })

  // Fetch execution history
  const { data: executions, isLoading: execLoading } = useQuery({
    queryKey: ['flows', flowId, 'executions'],
    queryFn: async () => {
      const response = await api.get(`/flows/${flowId}/executions`)
      return response.data.data
    },
  })

  const handleExecute = async () => {
    try {
      await api.post(`/flows/${flowId}/execute`)
      // Refetch executions
    } catch (error) {
      console.error('Failed to execute flow:', error)
    }
  }

  const handlePause = async () => {
    try {
      await api.patch(`/flows/${flowId}`, { status: 'paused' })
      // Refetch flow
    } catch (error) {
      console.error('Failed to pause flow:', error)
    }
  }

  const handleArchive = async () => {
    try {
      await api.patch(`/flows/${flowId}`, { status: 'archived' })
      navigate({ to: '/flows' })
    } catch (error) {
      console.error('Failed to archive flow:', error)
    }
  }

  if (flowLoading) {
    return <div className="text-center py-12">Loading flow...</div>
  }

  if (!flow) {
    return <div className="text-center py-12 text-red-600">Flow not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{flow.name}</h1>
          <p className="text-gray-600 mt-1">{flow.description}</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
            <span>Status: <strong>{flow.status}</strong></span>
            <span>Executions: <strong>{flow.executionCount}</strong></span>
            {flow.lastExecutedAt && (
              <span>Last run: <strong>{new Date(flow.lastExecutedAt).toLocaleDateString()}</strong></span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {flow.status !== 'active' && (
            <button
              onClick={handleExecute}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Play size={18} />
              Execute Now
            </button>
          )}
          {flow.status === 'active' && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
            >
              <Pause size={18} />
              Pause
            </button>
          )}
          <button
            onClick={handleArchive}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            <Archive size={18} />
            Archive
          </button>
        </div>
      </div>

      {/* Flow Definition */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Flow Definition</h2>
        <div className="bg-gray-50 p-4 rounded font-mono text-sm overflow-x-auto">
          <pre>{JSON.stringify(flow.definition, null, 2)}</pre>
        </div>
      </div>

      {/* Guardrails */}
      {flow.guardrails && flow.guardrails.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">Safety Guards</h2>
          <div className="space-y-2">
            {flow.guardrails.map((guard: any, idx: number) => (
              <div key={idx} className="text-sm text-blue-800">
                <strong>{guard.type}:</strong> {String(guard.value)} ({guard.source})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution History */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Execution History</h2>

        {execLoading ? (
          <div className="text-center py-8 text-gray-600">Loading executions...</div>
        ) : !executions || executions.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No executions yet</div>
        ) : (
          <div className="space-y-2">
            {executions.map((exec: any) => (
              <div
                key={exec.id}
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedExecution(expandedExecution === exec.id ? null : exec.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {exec.status === 'completed' ? '✅' : exec.status === 'failed' ? '❌' : '⏳'} {exec.status}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(exec.startedAt).toLocaleString()}
                      {exec.duration && ` • ${(exec.duration / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`transition-transform ${expandedExecution === exec.id ? 'rotate-180' : ''}`}
                  />
                </div>

                {expandedExecution === exec.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {exec.metrics && (
                      <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                        <div>Actions: {exec.metrics.actionsExecuted}</div>
                        <div>Spins: {exec.metrics.spinsExecuted}</div>
                        <div>Bonuses Claimed: {exec.metrics.bonusesClaimed}</div>
                        <div>Bonus Value: ${exec.metrics.bonusValueClaimed?.toFixed(2) || '0'}</div>
                        <div>Total Wagered: ${exec.metrics.totalWagered?.toFixed(2) || '0'}</div>
                        <div>Total Won: ${exec.metrics.totalWon?.toFixed(2) || '0'}</div>
                      </div>
                    )}

                    {exec.log && exec.log.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded text-sm max-h-64 overflow-y-auto">
                        <div className="font-medium mb-2">Log:</div>
                        {exec.log.slice(-10).map((log: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600 mb-1">
                            [{log.type}] {log.details?.message || JSON.stringify(log.details).substring(0, 100)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
