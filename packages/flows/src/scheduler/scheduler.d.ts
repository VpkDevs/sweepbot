/**
 * Flow Scheduler - Cron-based scheduling
 * Manages scheduled Flow executions using node-cron
 * Integrates with FlowExecutor to trigger flows on schedule
 */
import type { FlowDefinition } from '../types'
export interface FlowSchedulerOptions {
  onFlowExecute?: (flowId: string, userId: string) => Promise<void>
  onFlowError?: (flowId: string, userId: string, error: Error) => Promise<void>
  logger?: {
    info: (msg: string) => void
    error: (msg: string, err: any) => void
  }
}
export declare class FlowScheduler {
  private jobs
  private options
  private logger
  constructor(options?: FlowSchedulerOptions)
  /**
   * Activate a Flow for scheduled execution
   * Only works if flow.trigger.type === 'scheduled'
   */
  activateFlow(flow: FlowDefinition, userId: string): Promise<void>
  /**
   * Pause a scheduled Flow
   * Stops the cron job but keeps the flow's scheduled status
   */
  pauseFlow(flowId: string): Promise<void>
  /**
   * Resume a paused Flow
   * Re-activates the cron job
   */
  resumeFlow(flow: FlowDefinition, userId: string): Promise<void>
  /**
   * Get status of a scheduled flow
   */
  getFlowStatus(flowId: string, userId: string): 'active' | 'paused' | 'not_found'
  /**
   * Reactivate all active flows from the database
   * Called on scheduler startup to restore all scheduled flows
   */
  reactivateAllFlows(allFlows: FlowDefinition[]): Promise<void>
  /**
   * Shutdown the scheduler gracefully
   * Stops all running cron jobs
   */
  shutdown(): Promise<void>
  /**
   * Get list of all active scheduled flows
   */
  getActiveFlows(): string[]
}
//# sourceMappingURL=scheduler.d.ts.map
