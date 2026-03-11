export type ContentScriptMessage = 
  | { type: 'PAGE_LOADED' }
  | { type: 'GET_SESSION_STATS' }
  | { type: 'HUD_TOGGLE'; payload?: { enabled: boolean } }
  | { type: 'EXECUTE_FLOW'; payload: { flow: any } }
  | { type: 'FLOW_CANCEL'; payload: { flowId: string } }

export type BackgroundMessage =
  | { type: 'SHOW_NOTIFICATION'; payload: { title: string; message: string } }
  | { type: 'FLOW_COMPLETED'; payload: { flowId: string; success: boolean; error?: string } }

export type SessionData = {
  sessionId: string
  platformSlug: string
  startedAt: number
  coinsStart: { sc: number; gc: number }
  coinsCurrent: { sc: number; gc: number }
  transactionCount: number
  lastActivityAt: number
}