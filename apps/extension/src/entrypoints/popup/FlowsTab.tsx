/**
 * FlowsTab — Voice-scriptable automation tab in the SweepBot popup.
 *
 * User flow:
 * 1. Click mic → speak their automation aloud
 * 2. See live transcript + interpreted preview
 * 3. Confirm → flow saved, alarm scheduled
 * 4. Manage saved flows (pause / delete / run now)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, MicOff, Play, Pause, Trash2, Zap, ChevronDown, ChevronUp, Check, AlertTriangle, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { VoiceRecorder, type RecordingState } from '@/lib/voice-recorder'
import { storage } from '@/lib/storage'
import { flowInterpreter } from '@/lib/flows/interpreter'
import { flowStorage } from '@/lib/flows/storage'
import { scheduleFlow, unscheduleFlow } from '@/lib/flows/alarm-scheduler'
import type { FlowDefinition, FlowStep, InterpretationResult } from '@/lib/flows/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabView = 'record' | 'flows'

function hasPlatform(step: FlowStep): step is Extract<FlowStep, { platform: string }> {
  return 'platform' in step
}

/**
 * Render the FlowsTab UI for recording voice-driven automations and managing saved flows.
 *
 * Renders a two-tab interface: a Record tab that captures voice transcripts, shows live/interim transcript
 * and an interpretation preview for saving as a flow; and a My Flows tab that lists saved flows with controls
 * to activate/pause, run now, or delete. Handles recording lifecycle, interpretation, persistence, scheduling,
 * and local UI state.
 *
 * @returns The React element for the FlowsTab component.
 */

export default function FlowsTab() {
  const [view, setView] = useState<TabView>('record')
  const [flows, setFlows] = useState<FlowDefinition[]>([])
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [interimText, setInterimText] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [voiceConsent, setVoiceConsent] = useState<boolean | null>(null)
  const [privacyMode, setPrivacyMode] = useState(false)

  const recorderRef = useRef<VoiceRecorder | null>(null)

  // ── Load flows on mount ───────────────────────────────────────────────────

  useEffect(() => {
    setIsSupported(VoiceRecorder.isSupported())
    loadSettings()
    loadFlows()
  }, [])

  // Cleanup on unmount — ensure mic is dead
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.abort()
      }
    }
  }, [])

  async function loadSettings() {
    const consent = await storage.get('voiceConsentGranted')
    const pMode = await storage.get('voicePrivacyMode')
    setVoiceConsent(consent ?? false)
    setPrivacyMode(pMode ?? false)
  }

  /**
   * Load saved flows from persistent storage into the component state.
   *
   * Fetches all flow definitions from storage and updates the local `flows` state via `setFlows`.
   */
  async function loadFlows() {
    const all = await flowStorage.getAllFlows()
    setFlows(all)
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null)
    setFinalTranscript('')
    setInterimText('')
    setInterpretation(null)
    setSaved(false)

    const recorder = new VoiceRecorder({
      onInterim: (text) => setInterimText(text),
      onStateChange: (state) => setRecordingState(state),
    })
    recorderRef.current = recorder

    try {
      const transcript = await recorder.record()
      setFinalTranscript(transcript)
      setInterimText('')
      setRecordingState('processing')

      // Interpret the transcript
      const result = flowInterpreter.interpret(transcript)

      // Fallback & Responsible Play Stub
      if (result.confidence < 0.6) {
        // AI Fallback stub: In the future, this calls an LLM instead
        result.warnings.push("Confidence low. Attempted to enhance via AI (Stub).")
      }
      if (!result.flow.limits || result.flow.limits.maxDurationMs > 60 * 60 * 1000) {
        result.flow.limits = { ...result.flow.limits, maxDurationMs: 60 * 60 * 1000 }
        if (!result.warnings.includes("Added mandatory 1-hour session limit.")) {
          result.warnings.push("Added mandatory 1-hour session limit.")
        }
      }

      setInterpretation(result)
      setRecordingState('idle')

      // TTS Feedback
      if (window.speechSynthesis) {
        const platform = result.flow.steps.find(hasPlatform)?.platform ?? 'sweepstakes casino'
        const msg = result.confidence >= 0.6
          ? `Got it. Ready to save your automation for ${platform}.`
          : `I'm not quite sure I got that right. Please review the details.`
        const utterance = new SpeechSynthesisUtterance(msg)
        utterance.rate = 1.1
        window.speechSynthesis.speak(utterance)
      }
    } catch (err) {
      setError(String(err))
      setRecordingState('idle')
    }
  }, [])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }, [])

  // ── Save flow ─────────────────────────────────────────────────────────────

  const saveFlow = useCallback(async (customFlow?: FlowDefinition) => {
    if (!interpretation) return

    setSaving(true)
    try {
      const targetFlow = customFlow && (customFlow as any).id ? customFlow : interpretation.flow
      const flow: FlowDefinition = {
        ...targetFlow,
        status: targetFlow.trigger.type === 'scheduled' ? 'active' : 'draft',
      }

      await flowStorage.saveFlow(flow)

      if (flow.trigger.type === 'scheduled' && flow.status === 'active') {
        scheduleFlow(flow)
      }

      setFlows((prev) => {
        const filtered = prev.filter((f) => f.id !== flow.id)
        return [flow, ...filtered]
      })

      setSaved(true)
      setInterpretation(null)
      setFinalTranscript('')

      // Switch to flows list after save
      setTimeout(() => {
        setView('flows')
        setSaved(false)
      }, 1200)
    } catch (err) {
      setError(`Failed to save flow: ${err}`)
    } finally {
      setSaving(false)
    }
  }, [interpretation])

  // ── Flow management ───────────────────────────────────────────────────────

  const toggleFlowStatus = useCallback(
    async (flow: FlowDefinition) => {
      const newStatus = flow.status === 'active' ? 'paused' : 'active'
      await flowStorage.updateFlowStatus(flow.id, newStatus)

      if (newStatus === 'active' && flow.trigger.type === 'scheduled') {
        scheduleFlow({ ...flow, status: 'active' })
      } else {
        unscheduleFlow(flow.id)
      }

      setFlows((prev) =>
        prev.map((f) => (f.id === flow.id ? { ...f, status: newStatus } : f)),
      )
    },
    [],
  )

  const runFlowNow = useCallback(async (flow: FlowDefinition) => {
    await chrome.runtime.sendMessage({
      type: 'EXECUTE_FLOW_NOW',
      payload: { flowId: flow.id },
    })
  }, [])

  const deleteFlow = useCallback(async (flowId: string) => {
    unscheduleFlow(flowId)
    await flowStorage.deleteFlow(flowId)
    setFlows((prev) => prev.filter((f) => f.id !== flowId))
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 text-sm">
        <button
          onClick={() => setView('record')}
          className={`flex-1 py-2 font-medium transition ${
            view === 'record'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Mic className="w-3 h-3" /> Record
          </span>
        </button>
        <button
          onClick={() => { setView('flows'); loadFlows() }}
          className={`flex-1 py-2 font-medium transition ${
            view === 'flows'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" /> My Flows
            {flows.length > 0 && (
              <span className="ml-1 bg-blue-100 text-blue-700 text-xs rounded-full px-1.5 py-0.5 leading-none">
                {flows.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ── Record view ──────────────────────────────────────────────────────── */}
      {view === 'record' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {voiceConsent === false ? (
            <VoiceConsentView onAccept={async () => {
              await storage.set('voiceConsentGranted', true)
              setVoiceConsent(true)
            }} />
          ) : (
            <>
          {!isSupported ? (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Voice input requires Chrome. Try typing your automation below instead.
            </div>
          ) : null}

          {/* Mic button */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Speak your automation aloud — SweepBot will build the script instantly.
            </p>

            <button
              onClick={recordingState === 'listening' ? stopRecording : startRecording}
              disabled={recordingState === 'processing'}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all
                ${
                  recordingState === 'listening'
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : recordingState === 'processing'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }
              `}
            >
              {recordingState === 'processing' ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : recordingState === 'listening' ? (
                <MicOff className="w-7 h-7 text-white" />
              ) : (
                <Mic className="w-7 h-7 text-white" />
              )}
            </button>

            <p className="text-xs font-medium text-gray-600">
              {recordingState === 'listening'
                ? 'Listening… tap to stop'
                : recordingState === 'processing'
                ? 'Processing…'
                : 'Tap to speak'}
            </p>
          </div>

          {/* Live transcript */}
          {(interimText || finalTranscript) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 min-h-[48px]">
              <span className="font-medium text-gray-500 text-xs uppercase tracking-wide flex items-center justify-between">
                Transcript
                <button
                  onClick={() => {
                    const next = !privacyMode
                    setPrivacyMode(next)
                    storage.set('voicePrivacyMode', next)
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  title={privacyMode ? "Show transcript" : "Hide transcript"}
                >
                  {privacyMode ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </span>
              <p className={`mt-1 leading-relaxed ${privacyMode ? 'blur-sm select-none' : ''}`}>
                {finalTranscript || interimText}
                {recordingState === 'listening' && (
                  <span className="inline-block ml-1 w-0.5 h-4 bg-blue-500 animate-blink align-middle" />
                )}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Interpretation preview */}
          {interpretation && !error && (
            <InterpretationPreview
              result={interpretation}
              onConfirm={saveFlow}
              onDiscard={() => {
                setInterpretation(null)
                setFinalTranscript('')
              }}
              saving={saving}
              saved={saved}
            />
          )}

          {/* Example hint */}
          {!finalTranscript && !interimText && !error && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">💡 Example</p>
              <p className="leading-relaxed italic opacity-80">
                "Every day at 3 PM, log in to Chumba and collect my daily bonus, then spin on Sweet Bonanza. If my winnings are 5x the bonus amount or more, keep spinning. If not, stop."
              </p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-[10px] text-gray-400 leading-tight">
              SweepBot uses the Web Speech API. Audio data is processed by your browser and is not stored or transmitted by SweepBot until you save a flow.
            </p>
          </div>
          </>
        )}
        </div>
      )}

      {/* ── Flows list view ───────────────────────────────────────────────────── */}
      {view === 'flows' && (
        <div className="flex-1 overflow-y-auto">
          {flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-gray-400">
              <Zap className="w-8 h-8 opacity-30" />
              <p>No flows yet — record one!</p>
              <button
                onClick={() => setView('record')}
                className="text-blue-600 text-xs underline"
              >
                Start recording
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  expanded={expandedFlowId === flow.id}
                  onToggleExpand={() =>
                    setExpandedFlowId((prev) => (prev === flow.id ? null : flow.id))
                  }
                  onToggleStatus={toggleFlowStatus}
                  onRunNow={runFlowNow}
                  onDelete={deleteFlow}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Render a preview card for an interpreted automation flow, showing its name, human-readable summary,
 * confidence badge, warnings/ambiguities, trigger and step count, and actions to save or discard.
 *
 * @param result - InterpretationResult containing the interpreted `flow`, `confidence` (0–1), and any `warnings` or `ambiguities`
 * @param onConfirm - Called when the user confirms saving/activating the interpreted flow
 * @param onDiscard - Called when the user discards the interpretation
 * @param saving - Whether a save operation is currently in progress (disables the confirm action)
 * @param saved - Whether the interpretation has already been saved (changes confirm button state and label)
 * @returns The rendered preview card as a JSX element
 */

function InterpretationPreview({
  result,
  onConfirm,
  onDiscard,
  saving,
  saved,
}: {
  result: InterpretationResult
  onConfirm: (flow?: FlowDefinition) => void
  onDiscard: () => void
  saving: boolean
  saved: boolean
}) {
  const { confidence, warnings, ambiguities } = result
  const [editedFlow, setEditedFlow] = useState<FlowDefinition>(result.flow)
  const [isEditing, setIsEditing] = useState(false)
  const [editJson, setEditJson] = useState('')

  useEffect(() => {
    setEditedFlow(result.flow)
    setIsEditing(false)
  }, [result])

  const flow = isEditing ? result.flow : editedFlow
  const confidencePct = Math.round(confidence * 100)

  const handleToggleEdit = () => {
    if (isEditing) {
      try {
        const parsed = JSON.parse(editJson)
        setEditedFlow(parsed)
      } catch (e) {
        alert("Invalid JSON format. Please fix errors before saving edits.")
        return
      }
    } else {
      setEditJson(JSON.stringify(editedFlow, null, 2))
    }
    setIsEditing(!isEditing)
  }

  // Monetization Pro Gate Stub
  // const isScheduled = flow.trigger.type === 'scheduled'
  // const isProUser = false // TODO: Read from user profile context
  // const isGated = isScheduled && !isProUser

  return (
    <div className="border border-blue-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">Interpreted as:</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{flow.name}</p>
        </div>
        <ConfidenceBadge pct={confidencePct} />
      </div>

      {/* Summary */}
      <div className="px-4 py-3 text-xs text-gray-700 space-y-1 bg-gray-50 border-b border-gray-100">
        {flow.humanSummary.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {/* Warnings */}
      {(warnings.length > 0 || ambiguities.length > 0) && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
          {[...warnings, ...ambiguities].map((w, i) => (
            <p key={i} className="text-xs text-yellow-700 flex gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-yellow-500" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Raw Edit Mode */}
      {isEditing && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-500 mb-1.5 font-bold tracking-wide uppercase">Manual Correction (JSON)</p>
          <textarea
            value={editJson}
            onChange={(e) => setEditJson(e.target.value)}
            className="w-full h-32 text-xs font-mono p-2 border rounded border-gray-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Steps count */}
      <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 flex items-center justify-between">
        <div>
          {flow.steps.length} step{flow.steps.length !== 1 ? 's' : ''} ·{' '}
          {flow.trigger.type === 'scheduled'
            ? `Scheduled: ${(flow.trigger as { humanReadable: string }).humanReadable}`
            : 'Manual trigger'}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={() => onConfirm(editedFlow)}
          disabled={saving || saved || isEditing}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition
            ${saved
              ? 'bg-green-500 text-white'
              : isEditing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {saved ? (
            <><Check className="w-3.5 h-3.5" /> Saved!</>
          ) : saving ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
          ) : (
            <><Check className="w-3.5 h-3.5" /> Save &amp; Activate</>
          )}
        </button>
        <button
          onClick={handleToggleEdit}
          disabled={saving || saved}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center
            ${isEditing ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
        <button
          onClick={onDiscard}
          disabled={saving || saved}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition flex items-center justify-center"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

/**
 * Render a card summarizing a flow and provides controls to expand details, toggle status, run immediately, or delete.
 *
 * Displays the flow name, trigger label (scheduled human-readable or "Manual"), status/run/delete controls, and an expandable summary with runs, last executed date, and step count.
 *
 * @param flow - The FlowDefinition to display
 * @param expanded - Whether the card is shown in expanded state (reveals summary and metadata)
 * @param onToggleExpand - Called when the card header is clicked to toggle expanded state
 * @param onToggleStatus - Called with the flow when the user toggles between active and paused
 * @param onRunNow - Called with the flow when the user requests an immediate run
 * @param onDelete - Called with the flow id when the user confirms deletion
 * @returns The rendered flow card element
 */

function FlowCard({
  flow,
  expanded,
  onToggleExpand,
  onToggleStatus,
  onRunNow,
  onDelete,
}: {
  flow: FlowDefinition
  expanded: boolean
  onToggleExpand: () => void
  onToggleStatus: (f: FlowDefinition) => void
  onRunNow: (f: FlowDefinition) => void
  onDelete: (id: string) => void
}) {
  const isActive = flow.status === 'active'
  const trigger =
    flow.trigger.type === 'scheduled'
      ? (flow.trigger as { humanReadable: string }).humanReadable
      : 'Manual'

  return (
    <div className="px-4 py-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-left w-full"
          >
            <span
              className={`text-sm font-semibold truncate ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
            >
              {flow.name}
            </span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            )}
          </button>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{trigger}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleStatus(flow)}
            title={isActive ? 'Pause' : 'Activate'}
            className={`p-1.5 rounded-lg transition ${
              isActive
                ? 'bg-green-50 hover:bg-green-100 text-green-600'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-400'
            }`}
          >
            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onRunNow(flow)}
            title="Run now"
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
          >
            <Zap className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(flow.id)}
            title="Delete"
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded summary */}
      {expanded && (
        <div className="mt-3 space-y-1.5">
          <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 space-y-0.5">
            {flow.humanSummary.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="flex gap-3 text-xs text-gray-400">
            <span>Runs: {flow.executionCount}</span>
            {flow.lastExecutedAt && (
              <span>Last: {new Date(flow.lastExecutedAt).toLocaleDateString()}</span>
            )}
            <span>Steps: {flow.steps.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Renders a compact confidence badge showing a percentage and color-coded severity.
 *
 * @param pct - Confidence percentage from 0 to 100
 * @returns A small styled span element displaying "`{pct}% confidence`" with green styling for >= 80, yellow for >= 60, and red for < 60
 */

function ConfidenceBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'text-green-700 bg-green-100' :
    pct >= 60 ? 'text-yellow-700 bg-yellow-100' :
    'text-red-700 bg-red-100'

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {pct}% confidence
    </span>
  )
}

/**
 * Consent UI for voice features
 */
function VoiceConsentView({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
        <ShieldCheck className="w-8 h-8 text-blue-600" />
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900">Privacy & Voice Features</h3>
        <p className="text-xs font-semibold text-gray-700 bg-gray-100 p-2.5 rounded mx-4 border border-gray-200">
          SweepBot only listens when you click the Microphone button.
        </p>
        <p className="text-xs text-gray-500 px-4 leading-relaxed">
          Your audio is processed locally by your browser's Web Speech API and is never stored or transmitted.
        </p>
      </div>
      <div className="w-full pt-4 px-4 space-y-2">
        <button
          onClick={onAccept}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
        >
          Enable Voice Features
        </button>
        <p className="text-[10px] text-gray-400">
          You can disable this anytime in Settings.
        </p>
      </div>
    </div>
  )
}
