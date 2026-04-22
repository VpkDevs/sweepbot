import { executeFlow } from '../lib/flows/automation-executor'
import type { FlowDefinition } from '../lib/flows/types'

describe('flow automation executor (extension)', () => {
  beforeAll(() => {
    // stub chrome.runtime.sendMessage for tests
    ;(global as typeof globalThis & { chrome: typeof chrome }).chrome = {
      runtime: {
        sendMessage: vi.fn(() => Promise.resolve({})),
      },
    } as unknown as typeof chrome
  })

  it('completes a trivial flow with no steps', async () => {
    const flow: FlowDefinition = {
      id: 'f1',
      name: 'empty',
      description: '',
      status: 'draft',
      trigger: { type: 'manual' },
      steps: [],
      limits: { maxSpins: 0, maxDurationMs: 1000 },
      confidence: 1,
      humanSummary: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionCount: 0,
    }

    const exec = await executeFlow(flow)
    expect(exec.status).toBe('completed')
    expect(exec.stepResults.length).toBe(0)
  })

  it('aborts when maxDurationMs is exceeded', async () => {
    const flow: FlowDefinition = {
      id: 'f2',
      name: 'waiter',
      description: '',
      status: 'draft',
      trigger: { type: 'manual' },
      steps: [{ type: 'wait', ms: 2000, reason: 'slow' }],
      // very small duration to force abort
      limits: { maxSpins: 0, maxDurationMs: 1 },
      confidence: 1,
      humanSummary: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionCount: 0,
    }

    const exec = await executeFlow(flow)
    expect(['limit_reached', 'stopped']).toContain(exec.status)
  })
})
