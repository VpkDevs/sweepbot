import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FlowScheduler } from '../scheduler/scheduler'
import type { FlowDefinition } from '../types'

// mock node-cron to capture options passed to schedule()
vi.mock('node-cron', () => {
  return {
    schedule: (cron: string, fn: () => void, opts: any) => {
      return {
        start: () => {},
        stop: () => {},
        __cron: cron,
        __opts: opts,
      }
    },
  }
})

describe('FlowScheduler', () => {
  let scheduler: FlowScheduler

  beforeEach(() => {
    scheduler = new FlowScheduler()
  })

  it('should schedule a flow with timezone option and expose metadata', async () => {
    const flow: any = {
      id: 'flow-1',
      userId: 'user-1',
      trigger: { type: 'scheduled', cron: '0 0 * * *', timezone: 'America/New_York' },
      status: 'active',
    }

    await scheduler.activateFlow(flow as FlowDefinition, flow.userId)

    const info = scheduler.getJobInfo(flow.id, flow.userId)
    expect(info).toBeDefined()
    expect(info?.cron).toBe('0 0 * * *')
    expect(info?.timezone).toBe('America/New_York')
    expect(info?.job.__opts).toBeDefined()
    expect(info?.job.__opts.timezone).toBe('America/New_York')
  })

  it('pausing and resuming should clear and recreate jobs', async () => {
    const flow: any = {
      id: 'flow-2',
      userId: 'user-2',
      trigger: { type: 'scheduled', cron: '* * * * *', timezone: 'UTC' },
      status: 'active',
    }

    await scheduler.activateFlow(flow as FlowDefinition, flow.userId)
    expect(scheduler.getFlowStatus(flow.id, flow.userId)).toBe('active')

    await scheduler.pauseFlow(flow.id)
    expect(scheduler.getFlowStatus(flow.id, flow.userId)).toBe('paused')

    await scheduler.resumeFlow(flow as FlowDefinition, flow.userId)
    expect(scheduler.getFlowStatus(flow.id, flow.userId)).toBe('active')
  })
})
