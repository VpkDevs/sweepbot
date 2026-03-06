/**
 * Flow storage — persists FlowDefinitions and executions to chrome.storage.local.
 */

import type { FlowDefinition, FlowExecution } from './types'

const FLOWS_KEY = 'sweepbot_flows'
const EXECUTIONS_KEY = 'sweepbot_flow_executions'

/**
 * Load all stored flow definitions from the extension's local storage.
 *
 * @returns An array of `FlowDefinition` objects stored under the flows key; returns an empty array if no flows are found.
 */
async function getAllFlows(): Promise<FlowDefinition[]> {
  const result = await chrome.storage.local.get(FLOWS_KEY)
  return (result[FLOWS_KEY] as FlowDefinition[]) ?? []
}

/**
 * Saves a flow to persistent storage, updating an existing entry or adding a new one.
 *
 * If a flow with the same `id` already exists, its record is replaced and its `updatedAt` timestamp
 * is set to the current time; otherwise the flow is appended. The resulting flows array is persisted
 * to `chrome.storage.local` under `FLOWS_KEY`.
 *
 * @param flow - The FlowDefinition to save
 */
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

/**
 * Retrieve a flow definition by its identifier.
 *
 * @param id - The id of the flow to retrieve
 * @returns The FlowDefinition with the matching id, or `null` if not found
 */
async function getFlow(id: string): Promise<FlowDefinition | null> {
  const flows = await getAllFlows()
  return flows.find((f) => f.id === id) ?? null
}

/**
 * Removes the flow with the specified id from persistent flow storage.
 *
 * @param id - The identifier of the flow to remove
 */
async function deleteFlow(id: string): Promise<void> {
  const flows = await getAllFlows()
  await chrome.storage.local.set({
    [FLOWS_KEY]: flows.filter((f) => f.id !== id),
  })
}

/**
 * Update the status of a stored flow and refresh its updatedAt timestamp.
 *
 * If no flow with the given `id` exists, the function does nothing.
 *
 * @param id - The identifier of the flow to update
 * @param status - The new status value to assign to the flow
 */
async function updateFlowStatus(
  id: string,
  status: FlowDefinition['status'],
): Promise<void> {
  const flow = await getFlow(id)
  if (!flow) return
  await saveFlow({ ...flow, status, updatedAt: Date.now() })
}

/**
 * Records a flow execution in storage and updates the corresponding flow's metadata.
 *
 * The execution is prepended to the executions history (newest first) and the stored list is trimmed to the most recent 100 entries.
 * If a flow with `execution.flowId` exists, its `lastExecutedAt` is set to `execution.startedAt`, `executionCount` is incremented by 1, and `updatedAt` is set to the current time.
 *
 * @param execution - The execution record to store; `flowId` identifies the related flow and `startedAt` is used to update the flow's last execution time.
 */
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

/**
 * Retrieve executions belonging to a specific flow.
 *
 * @param flowId - The id of the flow whose executions should be returned
 * @returns An array of FlowExecution objects whose `flowId` matches the provided `flowId`; an empty array if none exist
 */
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
