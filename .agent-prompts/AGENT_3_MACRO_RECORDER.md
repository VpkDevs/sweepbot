# Agent 3: Macro Recorder MVP

## Mission

Build the Macro Recorder — a click-to-record browser automation tool that converts user actions into executable SweepBot flows. This is the viral marketing asset that will make demo videos irresistible.

## Context

You are working on **SweepBot** — the Bloomberg Terminal for sweepstakes casino players. See `AGENTS.md` for full project context.

**Current State:**

- Phase 1 complete: NLP flows engine (`packages/flows/`) with full AST executor ✅
- Extension foundation: Platform detection, storage, RTP calculator ✅
- Flow system: `flows`, `flow_executions` tables exist, API endpoints working ✅

**Problem:**

- Creating flows manually is intimidating for non-technical users
- NLP interpretation requires typing descriptions (friction)
- Competitor automation tools (Bet Angel, Zapier) have visual/recording features

**Your Goal:**
Build an MVP Macro Recorder that lets users click "Record," perform actions on casino sites, click "Stop," and instantly have a working flow. Target: <60 seconds from idea to working automation.

## Parallel Work Safety

**Agent 1** is building: `services/jackpot-poller/`, `services/tos-monitor/`, `services/health-checker/` (Replit services)
**Agent 2** is building: Quick wins (trial, streaks, notifications, voice notes) in `apps/web/` and `apps/api/`

**You own:** All extension files related to macro recording:

- `apps/extension/src/lib/macro-recorder.ts` (new)
- `apps/extension/src/components/MacroRecorder*.tsx` (new)
- `apps/extension/src/entrypoints/popup/` (modifications)
- `apps/extension/src/lib/flows/` (minor additions)

**Critical:** Do NOT touch:

- `services/` directory
- `apps/web/src/` (except flow pages if needed)
- `apps/api/src/services/notification-service.ts` or trial/streak services

---

## Feature Specification

### User Flow

1. User clicks extension icon → popup opens
2. Clicks "🔴 Record Macro" button
3. Badge appears on page: "Recording... Click Stop when done"
4. User performs actions: logs in, navigates, clicks bonus button, etc.
5. Clicks "Stop Recording" in popup
6. Extension shows preview: "Recorded 7 actions across 2 platforms"
7. User clicks "Save as Flow" → names it → saved to account
8. Flow appears in dashboard and can be scheduled/executed

### Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│ Content Script (runs on casino pages)              │
│ - Captures click events                             │
│ - Captures input events                             │
│ - Captures navigation                               │
│ - Takes screenshots at key moments                  │
│ - Sends events to background                        │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │ Background Script │
         │ MacroRecorder     │
         │ - Stores actions  │
         │ - Deduplicates    │
         │ - Classifies      │
         │ - Optimizes       │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │ Popup UI          │
         │ - Start/Stop      │
         │ - Preview         │
         │ - Save/Edit       │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │ AST Compiler      │
         │ - Actions → Nodes │
         │ - Add delays      │
         │ - Add guards      │
         └─────────┬─────────┘
                   │
             ┌─────▼────────┐
             │ FlowDefinition│
             │ (Save to API) │
             └──────────────┘
```

---

## Implementation Details

### Part 1: Event Capture System

**File:** `apps/extension/src/lib/macro-recorder.ts`

```typescript
import type { PlatformConfig } from './platforms'
import { platformDetector } from './platforms'
import { generateId } from '@sweepbot/utils'

export interface RecordedAction {
  id: string
  type: 'click' | 'input' | 'navigation' | 'wait'
  timestamp: number

  // DOM targeting
  selector: string
  xpath?: string
  elementText?: string
  elementTag?: string

  // For input events
  inputValue?: string

  // For navigation
  url?: string

  // Context
  platform: string
  platformSlug?: string

  // Classification (what is this action?)
  actionType:
    | 'login'
    | 'claim_bonus'
    | 'spin'
    | 'navigate'
    | 'check_balance'
    | 'cash_out'
    | 'unknown'
  confidence: number // 0-1

  // Optional screenshot
  screenshot?: string // data URL
}

export interface MacroRecording {
  id: string
  actions: RecordedAction[]
  startTime: number
  endTime: number
  platforms: string[]
  totalActions: number
}

export class MacroRecorder {
  private recording: boolean = false
  private actions: RecordedAction[] = []
  private startTime: number = 0
  private recordingId: string = ''

  // Action classification patterns
  private patterns = {
    login: /login|sign.?in|enter|username|password|auth/i,
    claimBonus: /claim|bonus|collect|redeem|free.?coins|daily/i,
    spin: /spin|play|bet|wager/i,
    cashOut: /cash.?out|withdraw|redeem/i,
    checkBalance: /balance|wallet|coins|account/i,
  }

  constructor() {
    this.setupListeners()
  }

  start(): string {
    this.recording = true
    this.actions = []
    this.startTime = Date.now()
    this.recordingId = generateId()

    console.log('[MacroRecorder] Recording started', this.recordingId)

    // Show recording badge
    this.showRecordingBadge()

    return this.recordingId
  }

  stop(): MacroRecording {
    this.recording = false
    const endTime = Date.now()

    console.log('[MacroRecorder] Recording stopped', this.actions.length, 'actions')

    // Hide badge
    this.hideRecordingBadge()

    // Optimize actions
    const optimized = this.optimizeActions(this.actions)

    // Get unique platforms
    const platforms = [...new Set(optimized.map((a) => a.platformSlug).filter(Boolean))]

    return {
      id: this.recordingId,
      actions: optimized,
      startTime: this.startTime,
      endTime,
      platforms,
      totalActions: optimized.length,
    }
  }

  private setupListeners() {
    // Will be attached when recording starts
  }

  private recordClick(event: MouseEvent) {
    if (!this.recording) return

    const target = event.target as HTMLElement
    if (!target) return

    // Generate robust selector
    const selector = this.generateSelector(target)
    const xpath = this.generateXPath(target)

    // Classify the action
    const classification = this.classifyAction(target)

    const action: RecordedAction = {
      id: generateId(),
      type: 'click',
      timestamp: Date.now(),
      selector,
      xpath,
      elementText: target.textContent?.trim().substring(0, 100),
      elementTag: target.tagName.toLowerCase(),
      platform: window.location.hostname,
      platformSlug: platformDetector.detect()?.slug,
      actionType: classification.type,
      confidence: classification.confidence,
    }

    this.actions.push(action)
    console.log('[MacroRecorder] Captured click', action)
  }

  private recordInput(event: Event) {
    if (!this.recording) return

    const target = event.target as HTMLInputElement
    if (!target) return

    // Don't record password values (security)
    const isPassword = target.type === 'password'

    const action: RecordedAction = {
      id: generateId(),
      type: 'input',
      timestamp: Date.now(),
      selector: this.generateSelector(target),
      inputValue: isPassword ? '***REDACTED***' : target.value,
      elementTag: target.tagName.toLowerCase(),
      platform: window.location.hostname,
      platformSlug: platformDetector.detect()?.slug,
      actionType: this.classifyAction(target).type,
      confidence: 0.8,
    }

    this.actions.push(action)
  }

  private recordNavigation(url: string) {
    if (!this.recording) return

    const action: RecordedAction = {
      id: generateId(),
      type: 'navigation',
      timestamp: Date.now(),
      url,
      selector: '',
      platform: new URL(url).hostname,
      platformSlug: platformDetector.detect()?.slug,
      actionType: 'navigate',
      confidence: 1.0,
    }

    this.actions.push(action)
  }

  private classifyAction(element: HTMLElement): {
    type: RecordedAction['actionType']
    confidence: number
  } {
    // Check element text, class names, IDs, aria-labels
    const text = (element.textContent || '').toLowerCase()
    const className = (element.className || '').toLowerCase()
    const id = (element.id || '').toLowerCase()
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase()

    const combined = `${text} ${className} ${id} ${ariaLabel}`

    // Pattern matching
    if (this.patterns.login.test(combined)) {
      return { type: 'login', confidence: 0.9 }
    }
    if (this.patterns.claimBonus.test(combined)) {
      return { type: 'claim_bonus', confidence: 0.85 }
    }
    if (this.patterns.spin.test(combined)) {
      return { type: 'spin', confidence: 0.8 }
    }
    if (this.patterns.cashOut.test(combined)) {
      return { type: 'cash_out', confidence: 0.9 }
    }
    if (this.patterns.checkBalance.test(combined)) {
      return { type: 'check_balance', confidence: 0.7 }
    }

    return { type: 'unknown', confidence: 0.3 }
  }

  private generateSelector(element: HTMLElement): string {
    // Prefer ID
    if (element.id) {
      return `#${element.id}`
    }

    // Try data attributes
    const dataTestId = element.getAttribute('data-testid')
    if (dataTestId) {
      return `[data-testid="${dataTestId}"]`
    }

    // Use class names + nth-child
    const classes = Array.from(element.classList)
      .filter((c) => !c.match(/^(active|hover|focus)/))
      .join('.')
    if (classes) {
      const parent = element.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter((e) => e.tagName === element.tagName)
        const index = siblings.indexOf(element)
        return `${element.tagName.toLowerCase()}.${classes}:nth-of-type(${index + 1})`
      }
      return `${element.tagName.toLowerCase()}.${classes}`
    }

    // Fallback: tag + nth-child
    return `${element.tagName.toLowerCase()}:nth-child(${this.getChildIndex(element)})`
  }

  private generateXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`
    }

    const paths: string[] = []
    let current: HTMLElement | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0
      let sibling = current.previousSibling

      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++
        }
        sibling = sibling.previousSibling
      }

      const tagName = current.nodeName.toLowerCase()
      const pathIndex = index > 0 ? `[${index + 1}]` : ''
      paths.unshift(`${tagName}${pathIndex}`)

      current = current.parentElement
    }

    return '/' + paths.join('/')
  }

  private getChildIndex(element: HTMLElement): number {
    let index = 1
    let sibling = element.previousElementSibling
    while (sibling) {
      index++
      sibling = sibling.previousElementSibling
    }
    return index
  }

  private optimizeActions(actions: RecordedAction[]): RecordedAction[] {
    const optimized: RecordedAction[] = []

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const prevAction = optimized[optimized.length - 1]

      // Remove duplicate clicks within 500ms
      if (
        prevAction &&
        prevAction.type === 'click' &&
        action.type === 'click' &&
        action.timestamp - prevAction.timestamp < 500 &&
        action.selector === prevAction.selector
      ) {
        continue
      }

      // Remove rapid input changes (only keep last value)
      if (
        prevAction &&
        prevAction.type === 'input' &&
        action.type === 'input' &&
        action.timestamp - prevAction.timestamp < 1000 &&
        action.selector === prevAction.selector
      ) {
        optimized[optimized.length - 1] = action // Replace with latest
        continue
      }

      optimized.push(action)
    }

    // Add smart delays between actions
    return this.addDelays(optimized)
  }

  private addDelays(actions: RecordedAction[]): RecordedAction[] {
    const withDelays: RecordedAction[] = []

    for (let i = 0; i < actions.length; i++) {
      withDelays.push(actions[i])

      if (i < actions.length - 1) {
        const currentAction = actions[i]
        const nextAction = actions[i + 1]
        const delay = nextAction.timestamp - currentAction.timestamp

        // Add explicit wait if delay > 2 seconds (user was thinking/waiting for page load)
        if (delay > 2000) {
          withDelays.push({
            id: generateId(),
            type: 'wait',
            timestamp: currentAction.timestamp + 100,
            selector: '',
            platform: currentAction.platform,
            platformSlug: currentAction.platformSlug,
            actionType: 'unknown',
            confidence: 1.0,
          })
        }
      }
    }

    return withDelays
  }

  private showRecordingBadge() {
    // Create floating badge
    const badge = document.createElement('div')
    badge.id = 'sweepbot-recording-badge'
    badge.innerHTML = `
      <style>
        #sweepbot-recording-badge {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-family: system-ui;
          font-size: 14px;
          font-weight: 600;
          z-index: 999999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      </style>
      🔴 Recording... Open extension to stop
    `
    document.body.appendChild(badge)
  }

  private hideRecordingBadge() {
    const badge = document.getElementById('sweepbot-recording-badge')
    if (badge) {
      badge.remove()
    }
  }
}

// Singleton instance
export const macroRecorder = new MacroRecorder()
```

---

### Part 2: Content Script Integration

**File:** `apps/extension/src/entrypoints/content.ts` (modifications)

Add event listeners when recording starts:

```typescript
import { macroRecorder } from '../lib/macro-recorder'

// Listen for recording control messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    const recordingId = macroRecorder.start()

    // Attach DOM listeners
    document.addEventListener('click', handleClick, true)
    document.addEventListener('input', handleInput, true)

    sendResponse({ success: true, recordingId })
  }

  if (message.type === 'STOP_RECORDING') {
    const recording = macroRecorder.stop()

    // Remove listeners
    document.removeEventListener('click', handleClick, true)
    document.removeEventListener('input', handleInput, true)

    sendResponse({ success: true, recording })
  }

  return true
})

function handleClick(event: MouseEvent) {
  // Forward to recorder
  macroRecorder['recordClick'](event)
}

function handleInput(event: Event) {
  // Forward to recorder
  macroRecorder['recordInput'](event)
}
```

---

### Part 3: Popup UI

**File:** `apps/extension/src/components/MacroRecorderButton.tsx`

```typescript
import { useState } from 'react';
import { type MacroRecording } from '../lib/macro-recorder';

export function MacroRecorderButton() {
  const [recording, setRecording] = useState(false);
  const [lastRecording, setLastRecording] = useState<MacroRecording | null>(null);

  const startRecording = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });

    if (response.success) {
      setRecording(true);
    }
  };

  const stopRecording = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });

    if (response.success) {
      setRecording(false);
      setLastRecording(response.recording);
    }
  };

  return (
    <div className="p-4">
      {!recording && !lastRecording && (
        <button
          onClick={startRecording}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
        >
          <span className="text-xl">🔴</span>
          Record Macro
        </button>
      )}

      {recording && (
        <button
          onClick={stopRecording}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 animate-pulse"
        >
          <span className="text-xl">⏹️</span>
          Stop Recording
        </button>
      )}

      {lastRecording && (
        <MacroPreview recording={lastRecording} onReset={() => setLastRecording(null)} />
      )}
    </div>
  );
}
```

**File:** `apps/extension/src/components/MacroPreview.tsx`

```typescript
import type { MacroRecording } from '../lib/macro-recorder';
import { compileToFlow } from '../lib/macro-compiler';
import { api } from '../lib/api';

interface Props {
  recording: MacroRecording;
  onReset: () => void;
}

export function MacroPreview({ recording, onReset }: Props) {
  const [saving, setSaving] = useState(false);
  const [flowName, setFlowName] = useState(`Recorded ${new Date().toLocaleDateString()}`);

  const saveAsFlow = async () => {
    setSaving(true);

    // Compile recording to FlowDefinition
    const flow = compileToFlow(recording, flowName);

    // Save to API
    try {
      await api.post('/flows', flow);
      alert('Flow saved successfully!');
      onReset();
    } catch (error) {
      alert('Failed to save flow: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">✅ Recording Complete</h3>
        <div className="text-sm text-green-800 space-y-1">
          <p><strong>{recording.totalActions}</strong> actions recorded</p>
          <p><strong>{recording.platforms.length}</strong> platforms detected</p>
          <p>Duration: <strong>{Math.round((recording.endTime - recording.startTime) / 1000)}s</strong></p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Flow Name</label>
        <input
          type="text"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div className="bg-gray-50 border rounded-lg p-3 max-h-40 overflow-y-auto">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Actions Preview:</h4>
        <ol className="text-xs space-y-1">
          {recording.actions.slice(0, 10).map((action, i) => (
            <li key={action.id} className="text-gray-700">
              {i + 1}. <span className="font-mono">{action.actionType}</span> on {action.platformSlug || 'unknown'}
            </li>
          ))}
          {recording.actions.length > 10 && (
            <li className="text-gray-500 italic">... and {recording.actions.length - 10} more</li>
          )}
        </ol>
      </div>

      <div className="flex gap-2">
        <button
          onClick={saveAsFlow}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save as Flow'}
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
```

---

### Part 4: Macro → Flow Compiler

**File:** `apps/extension/src/lib/macro-compiler.ts`

```typescript
import type { MacroRecording, RecordedAction } from './macro-recorder'
import type { FlowDefinition, FlowNode } from '@sweepbot/types'
import { generateId } from '@sweepbot/utils'

export function compileToFlow(recording: MacroRecording, name: string): FlowDefinition {
  const nodes: FlowNode[] = []

  // Group actions by platform
  const actionsByPlatform = groupByPlatform(recording.actions)

  // For each platform, create a sequence node
  for (const [platformSlug, actions] of Object.entries(actionsByPlatform)) {
    const sequenceNode: FlowNode = {
      id: generateId(),
      type: 'sequence',
      nodes: actions.map((action) => actionToNode(action, platformSlug)),
    }

    nodes.push(sequenceNode)
  }

  return {
    id: generateId(),
    userId: '', // Will be set by API
    name,
    description: `Macro recorded on ${new Date(recording.startTime).toLocaleString()}`,
    isActive: true,
    nodes,
    responsiblePlay: {
      maxDuration: 7200000, // 2 hours
      coolDownCheck: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function groupByPlatform(actions: RecordedAction[]): Record<string, RecordedAction[]> {
  const grouped: Record<string, RecordedAction[]> = {}

  for (const action of actions) {
    const platform = action.platformSlug || 'unknown'
    if (!grouped[platform]) {
      grouped[platform] = []
    }
    grouped[platform].push(action)
  }

  return grouped
}

function actionToNode(action: RecordedAction, platformSlug: string): FlowNode {
  switch (action.actionType) {
    case 'login':
      return {
        id: generateId(),
        type: 'action',
        action: 'login',
        platform: platformSlug,
      }

    case 'claim_bonus':
      return {
        id: generateId(),
        type: 'action',
        action: 'claim_bonus',
        platform: platformSlug,
        selector: action.selector,
      }

    case 'navigate':
      return {
        id: generateId(),
        type: 'action',
        action: 'navigate',
        url: action.url || '',
      }

    case 'unknown':
    default:
      // Generic click action
      return {
        id: generateId(),
        type: 'action',
        action: 'click',
        selector: action.selector,
        platform: platformSlug,
      }
  }
}
```

---

## Testing Strategy

### Manual Testing

1. **Record a simple flow:**
   - Open Chumba (or test site)
   - Click "Record Macro"
   - Click a few buttons
   - Stop recording
   - Verify preview shows correct actions

2. **Test compilation:**
   - Save recorded macro as flow
   - Go to web dashboard → Flows page
   - Verify flow appears
   - Inspect flow structure (should have sequence nodes)

3. **Test playback:**
   - Execute saved flow
   - Verify actions replay correctly
   - Check for errors in console

### Edge Cases

- Recording on non-supported platform (should still work, just no platform classification)
- Recording with rapid clicks (should deduplicate)
- Recording password inputs (should redact)
- Recording navigation across multiple platforms

---

## Deliverables

1. ✅ `MacroRecorder` class with event capture
2. ✅ Content script integration
3. ✅ Popup UI components (RecorderButton, Preview)
4. ✅ Macro → Flow compiler
5. ✅ Manual testing complete
6. ✅ Documentation in `apps/extension/README.md`

---

## Success Criteria

Your task is complete when:

- [ ] User can click "Record Macro" and see recording badge
- [ ] All clicks, inputs, and navigation are captured
- [ ] Recorded actions are optimized (deduped, delays added)
- [ ] Preview shows action count and platforms
- [ ] "Save as Flow" creates valid FlowDefinition and syncs to API
- [ ] Saved flow appears in web dashboard
- [ ] Flow can be executed (basic playback works)
- [ ] Code is TypeScript strict mode compliant
- [ ] No console errors during recording/playback

---

## Resources

- **Existing flow engine:** See `packages/flows/` for AST structure
- **Extension patterns:** See `apps/extension/src/lib/platforms.ts` for similar code
- **API client:** See `apps/extension/src/lib/api.ts`
- **Selector generation:** https://developer.chrome.com/docs/extensions/mv3/content_scripts/

---

**This is the feature that will make SweepBot famous. Every demo video will show someone recording a flow in 30 seconds. Make it flawless.**
