/**
 * Flows Page - Main dashboard for user's automation flows
 * Shows list of flows, creation options, and management controls
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Play, Pause, Trash2, Share2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/auth'

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
  const user = useAuthStore((state) => state.user)
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'paused'>('all')

  // Fetch user's flows
  const { data, isLoading, error } = useQuery({
    queryKey: ['flows', { filter, page: 1 }],
    queryFn: async () => {
      const response = await api.get('/flows', {
        params: {
          page: 1,
          pageSize: 50,
        },
      })
      return response.data.data
    },
  })

  const flows = data || []

  const handleCreateFlow = () => {
    navigate({ to: '/flows/create' })
  }

  const handleViewFlow = (flowId: string) => {
    navigate({ to: `/flows/${flowId}` })
  }

  const handleActivateFlow = async (flowId: string) => {
    await api.patch(`/flows/${flowId}`, {
      status: 'active',
    })
    // Invalidate query to refetch
  }

  const handlePauseFlow = async (flowId: string) => {
    await api.patch(`/flows/${flowId}`, {
      status: 'paused',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flows</h1>
          <p className="text-gray-600">Automate your sweepstakes casino routine with natural language</p>
        </div>
        <button
          onClick={handleCreateFlow}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          New Flow
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'active', 'draft', 'paused'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Failed to load flows. Please try again.
        </div>
      )}

      {/* Flows List */}
      {flows.length === 0 && !isLoading ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No flows yet. Create your first automation to get started!</p>
          <button
            onClick={handleCreateFlow}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create First Flow
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow: any) => (
            <div
              key={flow.id}
              className="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{flow.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        flow.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : flow.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{flow.description}</p>
                </div>
              </div>

              {/* Flow Meta */}
              <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                <div>Executions: {flow.executionCount}</div>
                {flow.lastExecutedAt && (
                  <div>Last run: {new Date(flow.lastExecutedAt).toLocaleDateString()}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewFlow(flow.id)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                >
                  View
                </button>
                {flow.status === 'draft' || flow.status === 'paused' ? (
                  <button
                    onClick={() => handleActivateFlow(flow.id)}
                    className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium flex items-center gap-2"
                  >
                    <Play size={16} />
                    Activate
                  </button>
                ) : (
                  <button
                    onClick={() => handlePauseFlow(flow.id)}
                    className="px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-sm font-medium flex items-center gap-2"
                  >
                    <Pause size={16} />
                    Pause
                  </button>
                )}
                <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium flex items-center gap-2">
                  <Share2 size={16} />
                  Share
                </button>
                <button className="px-4 py-2 text-red-600 hover:bg-red-50 rounded text-sm font-medium flex items-center gap-2">
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
