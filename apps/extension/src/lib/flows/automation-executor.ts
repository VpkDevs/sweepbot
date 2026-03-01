/**
 * Flow Automation Executor — runs inside a content script.
 * Receives a FlowDefinition and executes steps against the live DOM.
 *
 * Each action type maps to a concrete DOM interaction.
 * Steps that require navigation are co-ordinated with the background via messages.
 */

import type {
  FlowDefinition,
  FlowStep,
  FlowExecution,
  StepResult,
  Condition,
  ValueRef,
  LoopStep,
  IfStep,
  ClickStep,
  WaitForStep,
  ReadValueStep,
  SpinStep,
} from './types'
import { PLATFORM_SELECTORS } from './interpreter'

// ─── Public entry point ───────────────────────────────────────────────────────

export async function executeFlow(flow: FlowDefinition): Promise<FlowExecution> {
  const execution: FlowExecution = {
    id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    flowId: flow.id,
    startedAt: Date.now(),
    status: 'running',
    stepResults: [],
    variables: {},
  }

  const ctx: ExecutionContext = {
    execution,
    variables: {},
    aborted: false,
    startTime: Date.now(),
    maxDurationMs: flow.limits.maxDurationMs,
  }

  try {
    await runSteps(flow.steps, ctx)
    ctx.execution.status = ctx.aborted ? 'stopped' : 'completed'
  } catch (err) {
    ctx.execution.status = 'failed'
    ctx.execution.error = String(err)
    console.error('[Executor] Flow failed:', err)
  }

  ctx.execution.endedAt = Date.now()
  ctx.execution.variables = ctx.variables
  return ctx.execution
}

// ─── Execution context ────────────────────────────────────────────────────────

interface ExecutionContext {
  execution: FlowExecution
  variables: Record<string, unknown>
  aborted: boolean
  startTime: number
  maxDurationMs: number
}

// ─── Step runner ──────────────────────────────────────────────────────────────

async function runSteps(steps: FlowStep[], ctx: ExecutionContext): Promise<void> {
  for (const step of steps) {
    if (ctx.aborted) break
    if (Date.now() - ctx.startTime > ctx.maxDurationMs) {
      ctx.aborted = true
      ctx.execution.status = 'limit_reached'
      break
    }
    await runStep(step, ctx)
  }
}

async function runStep(step: FlowStep, ctx: ExecutionContext): Promise<void> {
  const t0 = Date.now()

  const result: StepResult = {
    stepType: step.type,
    description: describeStep(step),
    success: false,
    durationMs: 0,
  }

  try {
    switch (step.type) {
      case 'navigate':
        // Navigation is handled by the background — content script sends a message
        await sendToBackground({ type: 'FLOW_NAVIGATE', payload: { url: step.url } })
        result.success = true
        break

      case 'click':
        result.success = await clickElement(step)
        break

      case 'wait':
        await sleep(step.ms)
        result.success = true
        break

      case 'wait_for':
        result.success = await waitForElement(step.selector, step.timeout)
        break

      case 'read_value': {
        const value = await readValue(step, ctx)
        if (value !== null) {
          ctx.variables[step.variable] = value
          result.value = value
          result.success = true
        }
        break
      }

      case 'loop':
        await runLoop(step, ctx)
        result.success = true
        break

      case 'if':
        await runIf(step, ctx)
        result.success = true
        break

      case 'notify':
        chrome.runtime.sendMessage({
          type: 'FLOW_NOTIFY',
          payload: { title: step.title, message: step.message },
        })
        result.success = true
        break

      case 'stop':
        ctx.aborted = true
        ctx.execution.status = 'stopped'
        result.success = true
        result.description = `Stopped: ${step.reason}`
        break

      case 'login':
        result.success = await performLogin(step.platform, ctx)
        break

      case 'claim_bonus': {
        const amount = await claimBonus(step.platform)
        if (amount !== null && step.storeAmountAs) {
          ctx.variables[step.storeAmountAs] = amount
        }
        result.success = amount !== null
        result.value = amount
        break
      }

      case 'open_game':
        result.success = await openGame(step.platform, step.game)
        break

      case 'spin': {
        const win = await performSpin(step, ctx)
        if (step.storeWinAs) {
          ctx.variables[step.storeWinAs] = win ?? 0
        }
        result.success = win !== null
        result.value = win
        break
      }

      case 'store_variable': {
        ctx.variables[step.name] = resolveValue(step.value, ctx.variables)
        result.success = true
        break
      }

      default:
        console.warn('[Executor] Unknown step type:', (step as FlowStep).type)
        result.success = false
    }
  } catch (err) {
    result.success = false
    result.error = String(err)
    console.error(`[Executor] Step "${step.type}" failed:`, err)
  }

  result.durationMs = Date.now() - t0
  ctx.execution.stepResults.push(result)
}

// ─── Loop executor ────────────────────────────────────────────────────────────

async function runLoop(step: LoopStep, ctx: ExecutionContext): Promise<void> {
  const loopStart = Date.now()
  let iterations = 0

  while (true) {
    // Safety caps
    if (iterations >= step.maxIterations) {
      ctx.execution.status = 'limit_reached'
      break
    }
    if (Date.now() - loopStart > step.maxDurationMs) {
      ctx.execution.status = 'limit_reached'
      break
    }
    if (ctx.aborted) break

    const conditionMet = evaluateCondition(step.condition, ctx.variables)
    if (!conditionMet) break

    await runSteps(step.body, ctx)
    iterations++
  }
}

// ─── If executor ──────────────────────────────────────────────────────────────

async function runIf(step: IfStep, ctx: ExecutionContext): Promise<void> {
  const conditionMet = evaluateCondition(step.condition, ctx.variables)
  if (conditionMet) {
    await runSteps(step.then, ctx)
  } else if (step.else) {
    await runSteps(step.else, ctx)
  }
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

function evaluateCondition(
  condition: Condition,
  variables: Record<string, unknown>,
): boolean {
  const left = resolveValue(condition.left, variables)
  const right = resolveValue(condition.right, variables)

  const l = Number(left)
  const r = Number(right)

  switch (condition.operator) {
    case '>': return l > r
    case '<': return l < r
    case '>=': return l >= r
    case '<=': return l <= r
    case '==': return left == right
    case '!=': return left != right
    default: return false
  }
}

function resolveValue(
  ref: ValueRef,
  variables: Record<string, unknown>,
): unknown {
  switch (ref.kind) {
    case 'variable':
      return variables[ref.name] ?? 0
    case 'literal':
      return ref.value
    case 'multiply': {
      const base = Number(resolveValue(ref.ref, variables))
      return base * ref.factor
    }
  }
}

// ─── DOM Primitives ───────────────────────────────────────────────────────────

async function clickElement(step: ClickStep): Promise<boolean> {
  const timeout = step.timeout ?? 8000
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    let el: Element | null = null

    // 1. CSS selector
    if (step.selector) {
      el = document.querySelector(step.selector)
    }

    // 2. Text content match (works across shadow DOM surface)
    if (!el && step.text) {
      el = findByText(step.text)
    }

    // 3. ARIA label
    if (!el && step.ariaLabel) {
      el = document.querySelector(`[aria-label="${step.ariaLabel}"]`)
    }

    if (el) {
      scrollIntoView(el)
      await sleep(200) // small delay for CSS animations
      ;(el as HTMLElement).click()
      return true
    }

    await sleep(500)
  }

  console.warn(`[Executor] clickElement timed out — selector: "${step.selector}", text: "${step.text}"`)
  return false
}

async function waitForElement(selector: string, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await sleep(300)
  }
  return false
}

async function readValue(
  step: ReadValueStep,
  _ctx: ExecutionContext,
): Promise<number | string | null> {
  const el = document.querySelector(step.selector)
  if (!el) return null

  let raw: string
  if (step.attribute === 'text' || step.attribute === 'innerText') {
    raw = (el as HTMLElement).innerText ?? el.textContent ?? ''
  } else if (step.attribute === 'value') {
    raw = (el as HTMLInputElement).value ?? ''
  } else {
    raw = el.getAttribute(step.attribute) ?? ''
  }

  if (step.parseAs === 'number') {
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''))
    return isNaN(num) ? null : num
  }

  return raw.trim()
}

// ─── Platform-specific actions ────────────────────────────────────────────────

async function performLogin(platform: string, ctx: ExecutionContext): Promise<boolean> {
  const selectors = {
    ...(PLATFORM_SELECTORS._default),
    ...(PLATFORM_SELECTORS[platform] ?? {}),
  }

  // First check if already logged in (look for logout button or account menu)
  const alreadyIn =
    document.querySelector('[data-testid="account-menu"]') ||
    document.querySelector('.user-balance') ||
    findByText('Log Out') ||
    findByText('Sign Out')

  if (alreadyIn) {
    console.log(`[Executor] Already logged in to ${platform}`)
    return true
  }

  // Click login button
  const clicked = await clickElement({
    type: 'click',
    selector: selectors.loginButton,
    text: selectors.loginButtonText,
    timeout: 5000,
    description: 'Click login button',
  })

  if (!clicked) return false

  // Note: actual credential entry is NOT automated (security).
  // We pause here and wait for the user to complete login.
  await sendToBackground({
    type: 'FLOW_NEED_INPUT',
    payload: {
      message: `Please log in to ${platform} — SweepBot will continue once you're signed in.`,
    },
  })

  // Wait up to 60 seconds for login to complete
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const signedIn =
      document.querySelector('[data-testid="account-menu"]') ||
      document.querySelector('.user-balance') ||
      findByText('Log Out') ||
      findByText('Sign Out')
    if (signedIn) return true
    await sleep(2000)
  }

  return false
}

async function claimBonus(platform: string): Promise<number | null> {
  const selectors = {
    ...(PLATFORM_SELECTORS._default),
    ...(PLATFORM_SELECTORS[platform] ?? {}),
  }

  // Try to find and click the bonus button
  const clicked = await clickElement({
    type: 'click',
    selector: selectors.bonusButton,
    text: selectors.bonusButtonText,
    ariaLabel: 'Claim daily bonus',
    timeout: 10_000,
    description: 'Click bonus claim button',
  })

  if (!clicked) {
    console.warn('[Executor] Could not find bonus button on', platform)
    return null
  }

  await sleep(2000)

  // Read the bonus amount if a selector is configured
  if (selectors.bonusAmount) {
    const el = document.querySelector(selectors.bonusAmount)
    if (el) {
      const raw = (el as HTMLElement).innerText ?? el.textContent ?? ''
      const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
      if (!isNaN(amount)) return amount
    }
  }

  return 0 // bonus claimed but amount unknown
}

async function openGame(platform: string, game: string): Promise<boolean> {
  // Try to find the game card by name
  const gameSlug = game.replace(/-/g, ' ')
  const el = findByText(gameSlug)

  if (el) {
    scrollIntoView(el)
    await sleep(300)
    ;(el as HTMLElement).click()
    await sleep(3000)
    return true
  }

  return false
}

async function performSpin(step: SpinStep, ctx: ExecutionContext): Promise<number | null> {
  // Determine the platform from URL
  const hostname = window.location.hostname
  const platform = Object.keys(PLATFORM_SELECTORS).find(
    (k) => k !== '_default' && hostname.includes(k),
  ) ?? '_default'
  const selectors = {
    ...(PLATFORM_SELECTORS._default),
    ...(PLATFORM_SELECTORS[platform] ?? {}),
  }

  // Look for spin button inside iframe first
  const spinClicked = await clickInFrameOrDoc(
    selectors.spinButton,
    selectors.spinButtonText,
    8000,
  )

  if (!spinClicked) {
    console.warn('[Executor] Spin button not found')
    return null
  }

  // Wait for spin animation
  await sleep(3000)

  // Read win amount
  if (selectors.winAmount) {
    const el = findInFrameOrDoc(selectors.winAmount)
    if (el) {
      const raw = (el as HTMLElement).innerText ?? el.textContent ?? ''
      const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
      return isNaN(amount) ? 0 : amount
    }
  }

  return 0
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function findByText(text: string): Element | null {
  const lowerText = text.toLowerCase()
  const candidates = document.querySelectorAll('button, a, [role="button"], span, div')
  for (const el of candidates) {
    const content = (el as HTMLElement).innerText?.toLowerCase() ?? el.textContent?.toLowerCase() ?? ''
    if (content.trim() === lowerText) return el
  }
  return null
}

function scrollIntoView(el: Element): void {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    // ignore
  }
}

function findInFrameOrDoc(selector: string): Element | null {
  const doc = document.querySelector(selector)
  if (doc) return doc

  // Check iframes
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      const iframeDoc = iframe.contentDocument
      if (iframeDoc) {
        const found = iframeDoc.querySelector(selector)
        if (found) return found
      }
    } catch {
      // cross-origin iframe — skip
    }
  }

  return null
}

async function clickInFrameOrDoc(
  selector?: string,
  text?: string,
  timeout = 8000,
): Promise<boolean> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    // Try document
    let el: Element | null = selector ? document.querySelector(selector) : null
    if (!el && text) el = findByText(text)

    // Try iframes
    if (!el) {
      for (const iframe of document.querySelectorAll('iframe')) {
        try {
          const iframeDoc = iframe.contentDocument
          if (iframeDoc) {
            if (selector) el = iframeDoc.querySelector(selector)
            if (!el && text) {
              const txt = text.toLowerCase()
              const candidates = iframeDoc.querySelectorAll('button, a, [role="button"]')
              for (const c of candidates) {
                if ((c as HTMLElement).innerText?.toLowerCase().trim() === txt) {
                  el = c
                  break
                }
              }
            }
          }
        } catch {
          // cross-origin iframe
        }
        if (el) break
      }
    }

    if (el) {
      scrollIntoView(el)
      await sleep(150)
      ;(el as HTMLElement).click()
      return true
    }

    await sleep(400)
  }
  return false
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeStep(step: FlowStep): string {
  switch (step.type) {
    case 'navigate': return `Navigate to ${step.url}`
    case 'click': return step.description ?? `Click ${step.text ?? step.selector}`
    case 'wait': return `Wait ${step.ms}ms${step.reason ? ` (${step.reason})` : ''}`
    case 'wait_for': return `Wait for element: ${step.selector}`
    case 'read_value': return `Read ${step.variable} from ${step.selector}`
    case 'loop': return `Loop while condition is true (max ${step.maxIterations} iterations)`
    case 'if': return `If condition: ${JSON.stringify(step.condition)}`
    case 'notify': return `Notify: ${step.title}`
    case 'stop': return `Stop: ${step.reason}`
    case 'login': return `Login to ${step.platform}`
    case 'claim_bonus': return `Claim bonus on ${step.platform}`
    case 'open_game': return `Open game: ${step.game}`
    case 'spin': return `Spin${step.storeWinAs ? ` → ${step.storeWinAs}` : ''}`
    case 'store_variable': return `Store variable: ${step.name}`
    default: return 'unknown'
  }
}

async function sendToBackground(message: { type: string; payload?: unknown }): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}
