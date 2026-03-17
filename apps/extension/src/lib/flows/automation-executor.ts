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
  ReadValueStep,
  SpinStep,
} from './types'
import { PLATFORM_SELECTORS } from './interpreter'
import { createLogger } from '../logger'

const log = createLogger('AutomationExecutor')

/**
 * Execute a flow definition and produce its execution record.
 *
 * @param flow - The flow definition to run, including steps and execution limits
 * @returns The completed FlowExecution containing id, timestamps, final status, step results, collected variables, and error information if the run failed
 */

export async function executeFlow(flow: FlowDefinition): Promise<FlowExecution> {
  const execution: FlowExecution = {
    id: `exec_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`,
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
    // respect limit_reached if already set by runSteps
    if (!ctx.aborted) {
      ctx.execution.status = 'completed'
    } else if (ctx.execution.status !== 'limit_reached') {
      ctx.execution.status = 'stopped'
    }
  } catch (err) {
    ctx.execution.status = 'failed'
    ctx.execution.error = String(err)
    log.error('Flow failed:', err)
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

/**
 * Executes an ordered list of flow steps sequentially, respecting abort requests and the flow's overall time limit.
 *
 * @param steps - The steps to execute in order.
 * @param ctx - Execution context carrying execution state, per-flow variables, abort flag, start time, and maxDurationMs; may be updated (e.g., `ctx.aborted` or `ctx.execution.status`) if execution is halted or the time limit is reached.
 */

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

/**
 * Execute a single flow step, record its result on the execution, and apply any side effects to the execution context.
 *
 * Performs the action described by `step` (for example navigation, clicking, waiting, reading/storing values,
 * control-flow constructs, platform actions, notifications, or stopping), computes a StepResult with duration,
 * success, optional value or error information, and appends it to `ctx.execution.stepResults`. Side effects may
 * include updates to `ctx.variables`, `ctx.aborted`, and `ctx.execution.status`.
 *
 * @param step - The step to execute.
 * @param ctx - The execution context carrying the current execution state, variables, abort flag, and limits.
 */
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
        // sleep in small chunks so we can abort if the duration limit is reached
        let remaining = step.ms
        while (remaining > 0 && !ctx.aborted) {
          const chunk = Math.min(100, remaining)
          await sleep(chunk)
          remaining -= chunk
          if (Date.now() - ctx.startTime > ctx.maxDurationMs) {
            ctx.aborted = true
            ctx.execution.status = 'limit_reached'
            break
          }
        }
        result.success = !ctx.aborted
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
        log.warn('Unknown step type:', (step as FlowStep).type)
        result.success = false
    }
  } catch (err) {
    result.success = false
    result.error = String(err)
    log.error(`Step "${step.type}" failed:`, err)
  }

  result.durationMs = Date.now() - t0
  ctx.execution.stepResults.push(result)
}

/**
 * Executes a loop step's body repeatedly while the loop condition evaluates to true, enforcing iteration and duration limits.
 *
 * Repeatedly evaluates the loop condition and runs the step's body until the condition becomes false, the iteration count reaches `step.maxIterations`, the elapsed loop time exceeds `step.maxDurationMs`, or `ctx.aborted` is set. If an iteration or duration limit is reached, sets `ctx.execution.status` to `'limit_reached'`. Executing the body may modify `ctx` (for example, variables and step results).
 *
 * @param step - LoopStep containing the condition, body, `maxIterations`, and `maxDurationMs`
 * @param ctx - ExecutionContext used for running steps and preserving execution state
 */

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

/**
 * Evaluates the step's condition and executes the appropriate branch of steps.
 *
 * @param step - An `IfStep` containing `condition`, `then` steps, and an optional `else` branch
 * @param ctx - Execution context whose `variables` are used to evaluate the condition and which is passed to executed steps
 */

async function runIf(step: IfStep, ctx: ExecutionContext): Promise<void> {
  const conditionMet = evaluateCondition(step.condition, ctx.variables)
  if (conditionMet) {
    await runSteps(step.then, ctx)
  } else if (step.else) {
    await runSteps(step.else, ctx)
  }
}

/**
 * Evaluates a binary condition using the resolved left and right operands.
 *
 * @param condition - The condition containing `left`, `right`, and an `operator` to apply.
 * @param variables - Variable map used to resolve operand references.
 * @returns `true` if the comparison specified by `condition.operator` holds for the resolved operands, `false` otherwise.
 *
 * Comparison behavior:
 * - `>`, `<`, `>=`, `<=` convert operands to numbers and perform numeric comparison.
 * - `==` and `!=` use JavaScript loose equality between the resolved operand values.
 * - Any other operator returns `false`.
 */

function evaluateCondition(condition: Condition, variables: Record<string, unknown>): boolean {
  const left = resolveValue(condition.left, variables)
  const right = resolveValue(condition.right, variables)

  const l = Number(left)
  const r = Number(right)

  switch (condition.operator) {
    case '>':
      return l > r
    case '<':
      return l < r
    case '>=':
      return l >= r
    case '<=':
      return l <= r
    case '==':
      return left == right
    case '!=':
      return left != right
    default:
      return false
  }
}

/**
 * Resolve a ValueRef to a concrete value using the provided variables.
 *
 * @param ref - A value reference of kind `"variable"`, `"literal"`, or `"multiply"`.
 *   - `"variable"`: looks up the name in `variables` and returns its value or `0` if not found.
 *   - `"literal"`: returns the literal `value`.
 *   - `"multiply"`: resolves the nested reference and returns its numeric value multiplied by `factor`.
 * @param variables - Mapping of variable names to their current values used for resolving `"variable"` refs.
 * @returns The resolved value: the variable value or `0` for missing variables, the literal value, or the numeric product for `"multiply"` refs.
 */
function resolveValue(ref: ValueRef, variables: Record<string, unknown>): unknown {
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

/**
 * Attempts to locate an element (by CSS selector, visible text, or ARIA label), scrolls it into view, and clicks it within a timeout.
 *
 * @param step - Click step configuration; `selector`, `text`, or `ariaLabel` specify the target, and `timeout` overrides the default 8000 ms wait.
 * @returns `true` if an element was found and clicked before the timeout elapsed, `false` otherwise.
 */

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

  log.warn(`clickElement timed out — selector: "${step.selector}", text: "${step.text}"`)
  return false
}

/**
 * Waits until an element matching the provided CSS selector appears in the document or the timeout elapses.
 *
 * @param selector - CSS selector to query for
 * @param timeout - Maximum wait time in milliseconds
 * @returns `true` if an element matching `selector` was found before `timeout` expired, `false` otherwise.
 */
async function waitForElement(selector: string, timeout: number): Promise<boolean> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await sleep(300)
  }
  return false
}

/**
 * Extracts a value from the first DOM element matching the step's selector.
 *
 * Resolves the value from the element using `step.attribute` (`'text'`/`'innerText'` reads textual content, `'value'` reads input value, otherwise reads the named attribute). If `step.parseAs` is `'number'`, non-numeric characters are removed and the remaining text is parsed as a float.
 *
 * @param step - ReadValue step configuration (must include `selector`, may include `attribute` and `parseAs`)
 * @returns A numeric value when `parseAs` is `'number'` and parsing succeeds; a trimmed string when `parseAs` is not `'number'`; `null` if the element is not found or numeric parsing fails.
 */
async function readValue(
  step: ReadValueStep,
  _ctx: ExecutionContext
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

/**
 * Ensures the page is signed into the specified platform, prompting the user if automatic sign-in is not possible.
 *
 * Sends a background `FLOW_NEED_INPUT` request to notify the extension UI if manual login is required, then waits up to 60 seconds for login indicators to appear.
 *
 * @param platform - Platform identifier used to select platform-specific selectors
 * @param ctx - Execution context for the running flow
 * @returns `true` if the page is confirmed signed in, `false` otherwise.
 */

async function performLogin(platform: string, _ctx: ExecutionContext): Promise<boolean> {
  const selectors = {
    ...PLATFORM_SELECTORS._default,
    ...(PLATFORM_SELECTORS[platform] ?? {}),
  }

  // First check if already logged in (look for logout button or account menu)
  const alreadyIn =
    document.querySelector('[data-testid="account-menu"]') ||
    document.querySelector('.user-balance') ||
    findByText('Log Out') ||
    findByText('Sign Out')

  if (alreadyIn) {
    log.info(`Already logged in to ${platform}`)
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

/**
 * Attempts to claim the configured bonus for the given platform and report the amount when available.
 *
 * @param platform - Platform key used to select platform-specific DOM selectors
 * @returns The parsed bonus amount if readable; `0` if the bonus was claimed but the amount could not be determined; `null` if the bonus button could not be found or clicked
 */
async function claimBonus(platform: string): Promise<number | null> {
  const selectors = {
    ...PLATFORM_SELECTORS._default,
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
    log.warn('Could not find bonus button on', platform)
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

/**
 * Finds a game element by name and opens it by clicking the element.
 *
 * @param _platform - Platform identifier used to scope the lookup for the game
 * @param game - Game name or slug; dashes in `game` are treated as spaces when searching
 * @returns `true` if a matching element was found and clicked, `false` otherwise
 */
async function openGame(_platform: string, game: string): Promise<boolean> {
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

/**
 * Triggers a game spin on the current page (including inside iframes) and extracts the resulting win amount.
 *
 * @param _step - Spin step configuration containing selector hints for the spin button and win amount
 * @param _ctx - Execution context used for shared variables and execution state
 * @returns The parsed win amount if found, `0` if the spin completed but no numeric amount was parsed, or `null` if the spin button could not be found/clicked
 */
async function performSpin(_step: SpinStep, _ctx: ExecutionContext): Promise<number | null> {
  // Determine the platform from URL
  const hostname = window.location.hostname
  const platform =
    Object.keys(PLATFORM_SELECTORS).find((k) => k !== '_default' && hostname.includes(k)) ??
    '_default'
  const selectors = {
    ...PLATFORM_SELECTORS._default,
    ...(PLATFORM_SELECTORS[platform] ?? {}),
  }

  // Look for spin button inside iframe first
  const spinClicked = await clickInFrameOrDoc(selectors.spinButton, selectors.spinButtonText, 8000)

  if (!spinClicked) {
    log.warn('Spin button not found')
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

/**
 * Finds the first element whose visible text exactly matches the provided string (case-insensitive).
 *
 * @param text - The text to match against an element's visible text content
 * @returns The first matching Element, or `null` if none is found
 */

function findByText(text: string): Element | null {
  const lowerText = text.toLowerCase()
  const candidates = document.querySelectorAll('button, a, [role="button"], span, div')
  for (const el of candidates) {
    const content =
      (el as HTMLElement).innerText?.toLowerCase() ?? el.textContent?.toLowerCase() ?? ''
    if (content.trim() === lowerText) return el
  }
  return null
}

/**
 * Scrolls the given element into view centered in the viewport using smooth behavior.
 *
 * Errors thrown by the browser (for example due to unsupported options or restricted access) are ignored.
 *
 * @param el - The element to bring into view
 */
function scrollIntoView(el: Element): void {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    // ignore
  }
}

/**
 * Search for the first element matching a CSS selector in the main document and same-origin iframes.
 *
 * @param selector - A CSS selector string to match elements
 * @returns The first matching Element if found, `null` otherwise
 */
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

/**
 * Locate an element in the document or same-origin iframes by CSS selector or exact visible text and click it.
 *
 * @param selector - CSS selector to locate the target element within the document or same-origin iframe documents
 * @param text - Exact visible text to match (case-insensitive, trimmed) for candidate buttons/links/role="button" elements
 * @param timeout - Maximum time in milliseconds to keep searching and retrying before giving up
 * @returns `true` if an element was found and clicked, `false` otherwise
 */
async function clickInFrameOrDoc(
  selector?: string,
  text?: string,
  timeout = 8000
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

/**
 * Pauses execution for the specified duration.
 *
 * @param ms - Delay duration in milliseconds
 * @returns A promise that resolves after the delay
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Produce a concise, human-readable description for a flow step.
 *
 * @param step - The flow step to describe
 * @returns A short description string summarizing the action represented by `step`, suitable for UI labels or logs
 */
function describeStep(step: FlowStep): string {
  switch (step.type) {
    case 'navigate':
      return `Navigate to ${step.url}`
    case 'click':
      return step.description ?? `Click ${step.text ?? step.selector}`
    case 'wait':
      return `Wait ${step.ms}ms${step.reason ? ` (${step.reason})` : ''}`
    case 'wait_for':
      return `Wait for element: ${step.selector}`
    case 'read_value':
      return `Read ${step.variable} from ${step.selector}`
    case 'loop':
      return `Loop while condition is true (max ${step.maxIterations} iterations)`
    case 'if':
      return `If condition: ${JSON.stringify(step.condition)}`
    case 'notify':
      return `Notify: ${step.title}`
    case 'stop':
      return `Stop: ${step.reason}`
    case 'login':
      return `Login to ${step.platform}`
    case 'claim_bonus':
      return `Claim bonus on ${step.platform}`
    case 'open_game':
      return `Open game: ${step.game}`
    case 'spin':
      return `Spin${step.storeWinAs ? ` → ${step.storeWinAs}` : ''}`
    case 'store_variable':
      return `Store variable: ${step.name}`
    default:
      return 'unknown'
  }
}

/**
 * Sends a message to the Chrome extension background script.
 *
 * @param message - An object with a `type` string identifying the message and an optional `payload` containing any data to send
 * @returns The response from the background script
 */
async function sendToBackground(message: { type: string; payload?: unknown }): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}
