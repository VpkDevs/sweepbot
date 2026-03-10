/**
 * Ambient module declaration for node-cron@3.x
 * node-cron does not ship TypeScript types; this file provides them.
 */
declare module 'node-cron' {
  export interface ScheduleOptions {
    /** IANA timezone string, e.g. "America/New_York" */
    timezone?: string
    /** Whether to start the task immediately (default: true) */
    scheduled?: boolean
    /** Whether to run the task on init (default: false) */
    runOnInit?: boolean
    /** Named task identifier */
    name?: string
    /** Whether to recover missed executions (default: false) */
    recoverMissedExecutions?: boolean
  }

  export interface ScheduledTask {
    /** Start (or restart) the scheduled task */
    start(): void
    /** Stop the scheduled task */
    stop(): void
    /** Destroy the scheduled task permanently */
    destroy(): void
  }

  /** Schedule a function to run on a cron expression */
  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions,
  ): ScheduledTask

  /** Validate a cron expression */
  export function validate(expression: string): boolean

  /** Get all named scheduled tasks */
  export function getTasks(): Map<string, ScheduledTask>
}
