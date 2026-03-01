/**
 * Flow storage — persists FlowDefinitions and executions to chrome.storage.local.
 */

import type { FlowDefinition, FlowExecution } from './types'

const FLOWS_KEY = 'sweepbot_flows'
const EXECUTIONS_KEY = 'sweepbot_flow_executions'

async function getAllFlows(): Promise<FlowDefinition[]> {
  const result = await chrome.storage.local.get(FLOWS_KEY)
  return (result[FLOWS_KEY] as FlowDefinition[]) ?? []
}

async function saveFlow(flow: FlowDefinition): Promise<void> {
  const flows = await getAllFlows()
  const idx = flows.findIndex((f) => f.id === flow.id)
  if (idx >= 0) {
    flows[idx] = { ...flow, updatedAt: Date.now() }
  } else {
    flows.push(flow)
  }
  await chrome.storage.local.set({ [FLOWS_KEY]: flows })
}

async function getFlow(id: string): Promise<FlowDefinition | null> {
  const flows = await getAllFlows()
  return flows.find((f) => f.id === id) ?? null
}

async function deleteFlow(id: string): Promise<void> {
  const flows = await getAllFlows()
  await chrome.storage.local.set({
    [FLOWS_KEY]: flows.filter((f) => f.id !== id),
  })
}

async function updateFlowStatus(
  id: string,
  status: FlowDefinition['status'],
): Promise<void> {
  const flow = await getFlow(id)
  if (!flow) return
  await saveFlow({ ...flow, status, updatedAt: Date.now() })
}

async function recordExecution(execution: FlowExecution): Promise<void> {
  const result = await chrome.storage.local.get(EXECUTIONS_KEY)
  const executions: FlowExecution[] = result[EXECUTIONS_KEY] ?? []
  executions.unshift(execution) // newest first
  // Keep last 100 executions
  await chrome.storage.local.set({ [EXECUTIONS_KEY]: executions.slice(0, 100) })

  // Update flow's lastExecutedAt and count
  const flow = await getFlow(execution.flowId)
  if (flow) {
    await saveFlow({
      ...flow,
      lastExecutedAt: execution.startedAt,
      executionCount: flow.executionCount + 1,
      updatedAt: Date.now(),
    })
  }
}

async function getExecutionsForFlow(flowId: string): Promise<FlowExecution[]> {
  const result = await chrome.storage.local.get(EXECUTIONS_KEY)
  const executions: FlowExecution[] = result[EXECUTIONS_KEY] ?? []
  return executions.filter((e) => e.flowId === flowId)
}

export const flowStorage = {
  getAllFlows,
  saveFlow,
  getFlow,
  deleteFlow,
  updateFlowStatus,
  recordExecution,
  getExecutionsForFlow,
}
