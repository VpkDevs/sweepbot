export interface CapturedRequestRecord {
  id: string
  kind: 'fetch' | 'xhr'
  method: string
  url: string
  status: number | null
  pageUrl: string
  timestamp: number
  responseJson: unknown | null
}

export interface PlatformCaptureSnapshot {
  version: 1
  active: boolean
  startedAt: number
  updatedAt: number
  pageUrls: string[]
  requests: CapturedRequestRecord[]
}

export interface CaptureCandidate {
  id: string
  score: number
  url: string
  pageUrl: string
  kind: 'fetch' | 'xhr'
  method: string
  sample: unknown
  suggestedPaths: Record<string, string>
}

export interface PlatformCaptureAnalysis {
  balanceCandidates: CaptureCandidate[]
  transactionCandidates: CaptureCandidate[]
}

export function installPlatformCapture(): {
  installed: boolean
  startedAt: number
  currentUrl: string
} {
  const globalScope = window as typeof window & {
    __SWEEPBOT_PLATFORM_CAPTURE__?: PlatformCaptureSnapshot
  }
  const existing = globalScope.__SWEEPBOT_PLATFORM_CAPTURE__
  if (existing) {
    existing.active = true
    existing.updatedAt = Date.now()
    if (!existing.pageUrls.includes(window.location.href))
      existing.pageUrls.unshift(window.location.href)
    return { installed: true, startedAt: existing.startedAt, currentUrl: window.location.href }
  }

  const MAX_RECORDS = 40
  const MAX_DEPTH = 5
  const MAX_KEYS = 20
  const MAX_ARRAY_ITEMS = 5
  const state: PlatformCaptureSnapshot = {
    version: 1,
    active: true,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    pageUrls: [window.location.href],
    requests: [],
  }

  function trimValue(value: unknown, depth = 0): unknown {
    if (depth >= MAX_DEPTH) return '[truncated]'
    if (
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }
    if (Array.isArray(value))
      return value.slice(0, MAX_ARRAY_ITEMS).map((item) => trimValue(item, depth + 1))
    if (typeof value === 'object') {
      const trimmed: Record<string, unknown> = {}
      for (const key of Object.keys(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
        trimmed[key] = trimValue((value as Record<string, unknown>)[key], depth + 1)
      }
      return trimmed
    }
    return String(value)
  }

  function appendRecord(
    record: Omit<CapturedRequestRecord, 'id' | 'pageUrl' | 'timestamp'> & { responseJson: unknown }
  ): void {
    if (!state.active) return
    const pageUrl = window.location.href
    if (!state.pageUrls.includes(pageUrl)) state.pageUrls.unshift(pageUrl)
    state.updatedAt = Date.now()
    state.requests.unshift({
      id: `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      pageUrl,
      timestamp: state.updatedAt,
      responseJson: trimValue(record.responseJson),
      kind: record.kind,
      method: record.method,
      status: record.status,
      url: record.url,
    })
    state.requests = state.requests.slice(0, MAX_RECORDS)
  }

  function tryCapture(
    rawText: string,
    meta: Omit<CapturedRequestRecord, 'id' | 'pageUrl' | 'timestamp' | 'responseJson'>
  ): void {
    if (!rawText) return
    try {
      const parsed = JSON.parse(rawText)
      appendRecord({ ...meta, responseJson: parsed })
    } catch {
      // Ignore non-JSON payloads
    }
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const [resource, init] = args
    const request =
      typeof resource === 'string'
        ? { url: resource, method: init?.method ?? 'GET' }
        : resource instanceof URL
          ? { url: resource.toString(), method: init?.method ?? 'GET' }
          : resource
    const response = await originalFetch(...args)
    response
      .clone()
      .text()
      .then((text) => {
        tryCapture(text, {
          kind: 'fetch',
          method: request.method ?? 'GET',
          status: response.status,
          url: request.url,
        })
      })
      .catch(() => {})
    return response
  }

  const originalXhrOpen = XMLHttpRequest.prototype.open
  const originalXhrSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (...args: Parameters<XMLHttpRequest['open']>) {
    const [method, url] = args
    ;(
      this as XMLHttpRequest & { __sweepbotCaptureMeta__?: { method: string; url: string } }
    ).__sweepbotCaptureMeta__ = {
      method,
      url: String(url),
    }
    return originalXhrOpen.apply(this, args)
  }

  XMLHttpRequest.prototype.send = function (...args: Parameters<XMLHttpRequest['send']>) {
    this.addEventListener('load', () => {
      const meta = (
        this as XMLHttpRequest & { __sweepbotCaptureMeta__?: { method: string; url: string } }
      ).__sweepbotCaptureMeta__
      if (!meta || typeof this.responseText !== 'string') return
      tryCapture(this.responseText, {
        kind: 'xhr',
        method: meta.method,
        status: this.status,
        url: meta.url,
      })
    })
    return originalXhrSend.apply(this, args)
  }

  globalScope.__SWEEPBOT_PLATFORM_CAPTURE__ = state
  return { installed: true, startedAt: state.startedAt, currentUrl: window.location.href }
}

export function resetPlatformCapture(): PlatformCaptureSnapshot | null {
  const globalScope = window as typeof window & {
    __SWEEPBOT_PLATFORM_CAPTURE__?: PlatformCaptureSnapshot
  }
  const state = globalScope.__SWEEPBOT_PLATFORM_CAPTURE__
  if (!state) return null
  state.active = true
  state.startedAt = Date.now()
  state.updatedAt = state.startedAt
  state.pageUrls = [window.location.href]
  state.requests = []
  return JSON.parse(JSON.stringify(state)) as PlatformCaptureSnapshot
}

export function readPlatformCapture(): PlatformCaptureSnapshot | null {
  const globalScope = window as typeof window & {
    __SWEEPBOT_PLATFORM_CAPTURE__?: PlatformCaptureSnapshot
  }
  const state = globalScope.__SWEEPBOT_PLATFORM_CAPTURE__
  return state ? (JSON.parse(JSON.stringify(state)) as PlatformCaptureSnapshot) : null
}

function collectLeafPaths(
  value: unknown,
  prefix = '',
  paths: Array<{ path: string; value: string | number }> = []
): Array<{ path: string; value: string | number }> {
  if (value == null) return paths
  if (typeof value === 'number' || typeof value === 'string') {
    if (prefix) paths.push({ path: prefix, value })
    return paths
  }
  if (Array.isArray(value)) {
    value
      .slice(0, 5)
      .forEach((item, index) =>
        collectLeafPaths(item, prefix ? `${prefix}.${index}` : `${index}`, paths)
      )
    return paths
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      collectLeafPaths(nested, prefix ? `${prefix}.${key}` : key, paths)
    }
  }
  return paths
}

function firstPath(paths: Array<{ path: string }>, matcher: RegExp): string | undefined {
  return paths.find((entry) => matcher.test(entry.path))?.path
}

function scoreBalanceCandidate(
  url: string,
  paths: Array<{ path: string; value: string | number }>
): number {
  let score = /balance|wallet|coin|account|profile/i.test(url) ? 3 : 0
  if (firstPath(paths, /(sweeps|sweep|\.sc\b|^sc\b)/i)) score += 2
  if (firstPath(paths, /(gold|fun|fc|\.gc\b|^gc\b)/i)) score += 2
  if (firstPath(paths, /balance/i)) score += 1
  return score
}

function scoreTransactionCandidate(
  url: string,
  paths: Array<{ path: string; value: string | number }>
): number {
  let score = /spin|bet|game|play|round|wager/i.test(url) ? 2 : 0
  if (firstPath(paths, /(bet|wager|stake|amount)/i)) score += 2
  if (firstPath(paths, /(win|payout|prize|award)/i)) score += 2
  if (firstPath(paths, /(game|slot)/i)) score += 1
  if (firstPath(paths, /(round|transaction|spin.*id|id.*round)/i)) score += 1
  return score
}

function toCandidate(
  record: CapturedRequestRecord,
  score: number,
  kind: 'balance' | 'transaction'
): CaptureCandidate {
  const paths = collectLeafPaths(record.responseJson)
  const suggestedPaths =
    kind === 'balance'
      ? ({
          scPath: firstPath(paths, /(sweeps|sweep|\.sc\b|^sc\b)/i) ?? '',
          gcPath: firstPath(paths, /(gold|fun|fc|\.gc\b|^gc\b)/i) ?? '',
        } as Record<string, string>)
      : ({
          betAmountPath: firstPath(paths, /(bet|wager|stake|amount)/i) ?? '',
          winAmountPath: firstPath(paths, /(win|payout|prize|award)/i) ?? '',
          gameIdPath: firstPath(paths, /(game.*id|slot.*id|game\.|slot\.)/i) ?? '',
          roundIdPath: firstPath(paths, /(round.*id|transaction.*id|spin.*id)/i) ?? '',
        } as Record<string, string>)

  return {
    id: record.id,
    score,
    url: record.url,
    pageUrl: record.pageUrl,
    kind: record.kind,
    method: record.method,
    sample: record.responseJson,
    suggestedPaths,
  }
}

export function analyzePlatformCapture(
  snapshot: PlatformCaptureSnapshot | null
): PlatformCaptureAnalysis {
  if (!snapshot) return { balanceCandidates: [], transactionCandidates: [] }

  const balanceCandidates = snapshot.requests
    .map((record) => ({
      record,
      score: scoreBalanceCandidate(record.url, collectLeafPaths(record.responseJson)),
    }))
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ record, score }) => toCandidate(record, score, 'balance'))

  const transactionCandidates = snapshot.requests
    .map((record) => ({
      record,
      score: scoreTransactionCandidate(record.url, collectLeafPaths(record.responseJson)),
    }))
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ record, score }) => toCandidate(record, score, 'transaction'))

  return { balanceCandidates, transactionCandidates }
}

export function buildPlatformCaptureExport(
  tabUrl: string | null,
  snapshot: PlatformCaptureSnapshot | null
) {
  return {
    captureType: 'sweepbot-platform-onboarding',
    capturedAt: new Date().toISOString(),
    tabUrl,
    snapshot,
    analysis: analyzePlatformCapture(snapshot),
    instructions:
      'Send this report back to Augment to generate a PlatformConfig entry and any needed extension changes.',
  }
}
