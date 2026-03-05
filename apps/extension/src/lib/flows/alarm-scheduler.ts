/**
 * Chrome Alarms-based scheduler for FlowDefinitions.
 * Replaces node-cron from the @sweepbot/flows package — browser-safe.
 */

import type { FlowDefinition } from './types'

const ALARM_PREFIX = 'sweepbot_flow_'

/**
 * Schedule a flow's scheduled trigger as a Chrome alarm.
 *
 * If the flow's trigger type is not "scheduled" this is a no-op. Converts the
 * flow's cron expression into the next fire delay and recurrence period, clears
 * any existing alarm for the flow, and creates a Chrome alarm named
 * ALARM_PREFIX + flow.id using `when` for the first fire and `periodInMinutes`
 * (minimum 1 minute) for recurrence.
 *
 * @param flow - FlowDefinition with a `scheduled` trigger containing a cron expression
 */
export function scheduleFlow(flow: FlowDefinition): void {
  if (flow.trigger.type !== 'scheduled') return

  const alarmName = `${ALARM_PREFIX}${flow.id}`
  const { cron } = flow.trigger

  const { nextMs, periodMs } = cronToAlarmParams(cron)

  // Clear any existing alarm first
  chrome.alarms.clear(alarmName, () => {
    chrome.alarms.create(alarmName, {
      when: Date.now() + nextMs,
      periodInMinutes: Math.max(1, Math.round(periodMs / 60_000)),
    })
    console.log(
      `[FlowScheduler] Scheduled "${flow.name}" (${alarmName}) — next in ${Math.round(nextMs / 60_000)} min`,
    )
  })
}

/**
 * Removes the Chrome alarm associated with the specified flow.
 *
 * @param flowId - The flow identifier used to construct the alarm name
 */
export function unscheduleFlow(flowId: string): void {
  const alarmName = `${ALARM_PREFIX}${flowId}`
  chrome.alarms.clear(alarmName)
  console.log(`[FlowScheduler] Unscheduled flow ${flowId}`)
}

/**
 * Extracts the flow id from a namespaced alarm name.
 *
 * @param alarmName - The full alarm name potentially prefixed with ALARM_PREFIX
 * @returns The flow id substring after the prefix, or `null` if the name does not start with the prefix
 */
export function getFlowIdFromAlarm(alarmName: string): string | null {
  if (!alarmName.startsWith(ALARM_PREFIX)) return null
  return alarmName.slice(ALARM_PREFIX.length)
}

/**
 * Determine whether a Chrome alarm name corresponds to a scheduled flow.
 *
 * @param alarmName - The alarm name to inspect
 * @returns `true` if the name starts with the module's flow alarm prefix, `false` otherwise.
 */
export function isFlowAlarm(alarmName: string): boolean {
  return alarmName.startsWith(ALARM_PREFIX)
}

// ─── Cron → Chrome Alarm params ──────────────────────────────────────────────

interface AlarmParams {
  /** Milliseconds until next fire */
  nextMs: number
  /** Recurrence period in milliseconds */
  periodMs: number
}

/**
 * Convert a 5-field cron expression into the milliseconds until its next match and its recurrence period.
 *
 * Supports the restricted cron forms used by the scheduler:
 * - `MIN HOUR * * *` — daily at the specified hour and minute
 * - `MIN HOUR * * DOW` — weekly on the specified day-of-week (0–6)
 * - `0 * * * *` — hourly at the top of the hour
 * - `*/N * * * *` — every N minutes (step syntax)
 *
 * @param cron - A five-field cron string in the form "MIN HOUR DOM MON DOW"
 * @returns An object with:
 *   - `nextMs`: milliseconds until the next matching occurrence
 *   - `periodMs`: natural recurrence period in milliseconds for subsequent occurrences
 */
function cronToAlarmParams(cron: string): AlarmParams {
  const [min, hour, , , dow] = cron.trim().split(/\s+/)

  // Every N minutes: */N * * * *
  const everyN = min.match(/^\*\/(\d+)$/)
  if (everyN) {
    const n = parseInt(everyN[1])
    const periodMs = n * 60_000
    const nowMs = Date.now()
    const elapsed = nowMs % periodMs
    const nextMs = periodMs - elapsed
    return { nextMs, periodMs }
  }

  // Hourly: 0 * * * *
  if (min === '0' && hour === '*') {
    const now = new Date()
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    return { nextMs: next.getTime() - Date.now(), periodMs: 60 * 60_000 }
  }

  const m = parseInt(min)
  const h = parseInt(hour)

  // Daily or weekly
  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(h, m, 0, 0)

  if (dow !== '*') {
    // Weekly schedule: find next occurrence of target day at target time
    const targetDow = parseInt(dow)
    
    // First, check if today at target time hasn't passed yet
    if (candidate.getTime() > now.getTime() && candidate.getDay() === targetDow) {
      // Today is the right day and time hasn't passed
      return {
        nextMs: candidate.getTime() - Date.now(),
        periodMs: 7 * 24 * 60 * 60_000,
      }
    }
    
    // Otherwise, find the next occurrence of this day of week
    const daysUntilTarget = (targetDow - candidate.getDay() + 7) % 7
    const daysToAdd = daysUntilTarget === 0 ? 7 : daysUntilTarget
    candidate.setDate(candidate.getDate() + daysToAdd)
    
    return {
      nextMs: candidate.getTime() - Date.now(),
      periodMs: 7 * 24 * 60 * 60_000,
    }
  }

  // Daily schedule
  if (candidate.getTime() <= now.getTime()) {
    // Already passed today — push to tomorrow
    candidate.setDate(candidate.getDate() + 1)
  }

  return {
    nextMs: candidate.getTime() - Date.now(),
    periodMs: 24 * 60 * 60_000,
  }
}
