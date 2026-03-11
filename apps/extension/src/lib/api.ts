import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('ExtensionAPI')

const API_BASE = 'http://localhost:3001/api/v1'

type SessionResponse = {
  sessionId: string
  message: string
}

type TransactionRequest = {
  game_id: string
  bet_amount: number
  win_amount: number
  result: 'win' | 'loss' | 'bonus'
}

export class ExtensionAPI {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await storage.get('authToken')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  async createSession(platformSlug: string, gameId: string): Promise<SessionResponse> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        platform_slug: platformSlug,
        game_id: gameId,
        started_at: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data
  }

  async recordTransaction(sessionId: string, transaction: TransactionRequest): Promise<void> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...transaction,
        timestamp: new Date().toISOString()
      })
    })

    if (!response.ok) {
      log.error(`Failed to record transaction: ${response.statusText}`)
    }
  }

  async updateSessionBalance(sessionId: string, scBalance: number, gcBalance: number): Promise<void> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/balance`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sc_balance: scBalance,
        gc_balance: gcBalance
      })
    })

    if (!response.ok) {
      log.error(`Failed to update balance: ${response.statusText}`)
    }
  }

  async endSession(sessionId: string): Promise<{ rtp: number; netResult: number }> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/end`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        ended_at: new Date().toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data
  }

  async batchTransactions(sessionId: string, transactions: TransactionRequest[]): Promise<void> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${API_BASE}/sessions/transactions/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        transactions: transactions.map(tx => ({
          ...tx,
          timestamp: new Date().toISOString()
        }))
      })
    })

    if (!response.ok) {
      log.error(`Failed to batch transactions: ${response.statusText}`)
    }
  }
}

export const extensionApi = new ExtensionAPI()