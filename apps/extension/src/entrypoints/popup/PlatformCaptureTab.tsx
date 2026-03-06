import { useMemo, useState } from 'react'
import { Copy, RefreshCw, Play, RotateCcw } from 'lucide-react'
import {
  analyzePlatformCapture,
  buildPlatformCaptureExport,
  installPlatformCapture,
  readPlatformCapture,
  resetPlatformCapture,
  type PlatformCaptureSnapshot,
} from '@/lib/platform-capture'

const MAIN_WORLD = 'MAIN' as chrome.scripting.ExecutionWorld

export default function PlatformCaptureTab() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<PlatformCaptureSnapshot | null>(null)
  const [tabUrl, setTabUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const analysis = useMemo(() => analyzePlatformCapture(snapshot), [snapshot])

  async function withActiveTab<T>(action: (tabId: number, url: string | null) => Promise<T>): Promise<T> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) {
      throw new Error('Open the target platform in an http(s) tab first.')
    }
    setTabUrl(tab.url)
    return action(tab.id, tab.url)
  }

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setCopied(false)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleStart = () => runAction(async () => {
    await withActiveTab(async (tabId) => {
      await chrome.scripting.executeScript({ target: { tabId }, world: MAIN_WORLD, func: installPlatformCapture })
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: MAIN_WORLD, func: readPlatformCapture })
      setSnapshot(result ?? null)
    })
  })

  const handleReset = () => runAction(async () => {
    await withActiveTab(async (tabId) => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: MAIN_WORLD, func: resetPlatformCapture })
      setSnapshot(result ?? null)
    })
  })

  const handleRefresh = () => runAction(async () => {
    await withActiveTab(async (tabId) => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: MAIN_WORLD, func: readPlatformCapture })
      setSnapshot(result ?? null)
      if (!result) throw new Error('Capture not started yet. Click Start Capture first.')
    })
  })

  const handleCopy = () => runAction(async () => {
    const exportData = buildPlatformCaptureExport(tabUrl, snapshot)
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    setCopied(true)
  })

  return (
    <div className="p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Platform Capture Tool</h2>
        <p className="text-xs text-gray-600 mt-1">
          Capture balance and spin payloads from the current tab, then copy the report back here.
        </p>
      </div>

      <ol className="text-xs text-gray-600 space-y-1 list-decimal pl-4">
        <li>Open the target platform tab.</li>
        <li>Click <strong>Start Capture</strong>.</li>
        <li>If you need page-load traffic, refresh after starting capture.</li>
        <li>Use the site: load balance, open a game, spin once.</li>
        <li>Re-open the popup, refresh, then copy the report.</li>
      </ol>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={handleStart} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          <span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5" />Start Capture</span>
        </button>
        <button onClick={handleRefresh} disabled={busy} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800 disabled:opacity-60">
          <span className="inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" />Refresh</span>
        </button>
        <button onClick={handleReset} disabled={busy} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800 disabled:opacity-60">
          <span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" />Reset</span>
        </button>
        <button onClick={handleCopy} disabled={busy || !snapshot} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          <span className="inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" />Copy Report</span>
        </button>
      </div>

      {tabUrl && <div className="rounded-lg bg-gray-50 p-2 text-[11px] text-gray-600 break-all">Active tab: {tabUrl}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">{error}</div>}
      {copied && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">Report copied. Paste it back into chat.</div>}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-gray-50 p-2"><div className="text-gray-500">Requests</div><div className="font-semibold text-gray-900">{snapshot?.requests.length ?? 0}</div></div>
        <div className="rounded-lg bg-gray-50 p-2"><div className="text-gray-500">Balance</div><div className="font-semibold text-gray-900">{analysis.balanceCandidates.length}</div></div>
        <div className="rounded-lg bg-gray-50 p-2"><div className="text-gray-500">Spins</div><div className="font-semibold text-gray-900">{analysis.transactionCandidates.length}</div></div>
      </div>

      <CandidateSection title="Balance candidates" candidates={analysis.balanceCandidates} />
      <CandidateSection title="Transaction candidates" candidates={analysis.transactionCandidates} />
    </div>
  )
}

function CandidateSection({ title, candidates }: { title: string; candidates: ReturnType<typeof analyzePlatformCapture>['balanceCandidates'] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
      {candidates.length === 0 ? (
        <div className="rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500">No strong matches yet.</div>
      ) : (
        candidates.slice(0, 2).map((candidate) => (
          <div key={candidate.id} className="rounded-lg border border-gray-200 p-2 text-[11px] text-gray-700 space-y-1">
            <div><strong>URL:</strong> <span className="break-all">{candidate.url}</span></div>
            <div className="flex gap-2"><span>Score {candidate.score}</span><span>{candidate.method}</span><span>{candidate.kind}</span></div>
            <div className="rounded bg-gray-50 p-2 overflow-x-auto"><pre>{JSON.stringify(candidate.suggestedPaths, null, 2)}</pre></div>
          </div>
        ))
      )}
    </div>
  )
}