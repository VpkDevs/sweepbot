/**
 * Flow Scheduler - Cron-based scheduling
 * Manages scheduled Flow executions using node-cron
 * Integrates with FlowExecutor to trigger flows on schedule
 */

import type { FlowDefinition } from '../types'

// Using dynamic import for node-cron to avoid issues with ESM
let CronJob: any
let cronSchedule: any

/**
 * Lazily loads the node-cron library and caches its scheduler helpers for the module.
 *
 * If the cron helpers are not already loaded, imports `node-cron` dynamically and stores
 * the schedule function and the cron module in the module-level caches so subsequent
 * scheduler operations can use them without re-importing.
 */
async function loadCron() {
  if (!CronJob) {
    // @ts-ignore - node-cron doesn't have published types
    const cron = await import('node-cron')
    CronJob = cron.schedule
    cronSchedule = cron
  }
}

export interface FlowSchedulerOptions {
  onFlowExecute?: (flowId: string, userId: string) => Promise<void>
  onFlowError?: (flowId: string, userId: string, error: Error) => Promise<void>
  logger?: { info: (msg: string) => void; error: (msg: string, err: any) => void }
}

export class FlowScheduler {
  /**
   * Map of jobKey -> metadata object. We keep the raw cron job plus
   * convenient metadata for testing and introspection (cron string,
   * timezone, userId, etc.).
   */
  private jobs = new Map<string, { job: any; cron?: string; timezone?: string; userId?: string }>()
  private options: FlowSchedulerOptions
  private logger: { info: (msg: string) => void; error: (msg: string, err: any) => void }

  constructor(options: FlowSchedulerOptions = {}) {
    this.options = options
    this.logger = options.logger || {
      info: (msg) => console.log(`[FlowScheduler] ${msg}`),
      error: (msg, err) => console.error(`[FlowScheduler] ${msg}`, err),
    }
  }

  /**
   * Activate a Flow for scheduled execution
   * Only works if flow.trigger.type === 'scheduled'
   */
  async activateFlow(flow: FlowDefinition, userId: string): Promise<void> {
    if (flow.trigger.type !== 'scheduled') {
      this.logger.info(`Flow ${flow.id} is not scheduled (trigger: ${flow.trigger.type}), skipping`)
      return
    }

    await loadCron()

    const { cron, timezone } = flow.trigger
    const jobKey = `${userId}:${flow.id}`

    // Remove existing job if it exists
    await this.pauseFlow(flow.id)

    try {
      // Create cron job - include timezone if specified
      const jobOptions: any = {}
      if (timezone) {
        jobOptions.timezone = timezone
      }

      const job = CronJob(cron, async () => {
        try {
          this.logger.info(`Executing scheduled flow ${flow.id} for user ${userId}`)
          if (this.options.onFlowExecute) {
            await this.options.onFlowExecute(flow.id, userId)
          }
        } catch (error) {
          this.logger.error(`Flow ${flow.id} execution failed`, error)
          if (this.options.onFlowError) {
            await this.options.onFlowError(flow.id, userId, error as Error)
          }
        }
      }, jobOptions)

      // Start the job
      job.start()
      // store metadata so tests / introspection can inspect timezone/cron
      this.jobs.set(jobKey, { job, cron, timezone, userId })

      this.logger.info(`Flow ${flow.id} scheduled: cron="${cron}" timezone="${timezone}" for user ${userId}`)
    } catch (error) {
      this.logger.error(`Failed to schedule flow ${flow.id}`, error)
      throw new Error(`Failed to schedule flow: ${(error as Error).message}`)
    }
  }

  /**
   * Pause a scheduled Flow
   * Stops the cron job but keeps the flow's scheduled status
   */
  async pauseFlow(flowId: string): Promise<void> {
    // Find and stop all jobs for this flow (across all users)
    for (const [jobKey, meta] of this.jobs.entries()) {
      if (jobKey.endsWith(`:${flowId}`)) {
        try {
          meta.job.stop()
          this.jobs.delete(jobKey)
          this.logger.info(`Paused flow ${flowId}`)
        } catch (error) {
          this.logger.error(`Failed to pause flow ${flowId}`, error)
        }
      }
    }
  }

  /**
   * Resume a paused Flow
   * Re-activates the cron job
   */
  async resumeFlow(flow: FlowDefinition, userId: string): Promise<void> {
    await this.pauseFlow(flow.id)
    await this.activateFlow(flow, userId)
    this.logger.info(`Resumed flow ${flow.id} for user ${userId}`)
  }

  /**
   * Get status of a scheduled flow
   */
  getFlowStatus(flowId: string, userId: string): 'active' | 'paused' | 'not_found' {
    const jobKey = `${userId}:${flowId}`
    return this.jobs.has(jobKey) ? 'active' : 'paused'
  }

  /**
   * Reactivate all active flows from the database
   * Called on scheduler startup to restore all scheduled flows
   */
  async reactivateAllFlows(allFlows: FlowDefinition[]): Promise<void> {
    this.logger.info(`Reactivating ${allFlows.length} flows on startup`)

    let activatedCount = 0
    for (const flow of allFlows) {
      if (flow.status === 'active' && flow.trigger.type === 'scheduled') {
        try {
          await this.activateFlow(flow, flow.userId)
          activatedCount++
        } catch (error) {
          this.logger.error(`Failed to reactivate flow ${flow.id}`, error)
        }
      }
    }

    this.logger.info(`Successfully reactivated ${activatedCount} flows`)
  }

  /**
   * Shutdown the scheduler gracefully
   * Stops all running cron jobs
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down FlowScheduler...')

    for (const [jobKey, meta] of this.jobs.entries()) {
      try {
        meta.job.stop()
        this.jobs.delete(jobKey)
      } catch (error) {
        this.logger.error(`Failed to stop job ${jobKey}`, error)
      }
    }

    this.logger.info('FlowScheduler shutdown complete')
  }

  /**
   * Get list of all active scheduled flows
   */
  getActiveFlows(): string[] {
    return Array.from(this.jobs.keys())
  }

  /**
   * Inspect metadata for a specific job (used in tests / debugging)
   */
  getJobInfo(flowId: string, userId: string): { job: any; cron?: string; timezone?: string; userId?: string } | undefined {
    const key = `${userId}:${flowId}`
    return this.jobs.get(key)
  }
}
