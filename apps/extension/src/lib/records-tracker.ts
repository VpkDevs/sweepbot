/**
 * Personal Records Tracker
 * Tracks user's best sessions, biggest wins, and performance milestones
 */

import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('RecordsTracker')

export interface PersonalRecord {
  value: number
  timestamp: number
  platformSlug: string
  gameId?: string
  sessionId?: string
}

export interface PersonalRecords {
  biggestWin: PersonalRecord | null
  highestRTP: PersonalRecord | null
  longestSession: PersonalRecord | null // duration in minutes
  mostSpins: PersonalRecord | null
  biggestProfit: PersonalRecord | null // net result
  fastestBonus: PersonalRecord | null // spins until bonus trigger
}

export interface RecordUpdate {
  recordType: keyof PersonalRecords
  newRecord: PersonalRecord
  previousRecord: PersonalRecord | null
}

class RecordsTracker {
  private readonly STORAGE_KEY = 'personalRecords'

  async checkAndUpdateRecords(sessionData: {
    biggestWin?: number
    rtp?: number
    durationMinutes?: number
    spinCount?: number
    netResult?: number
    spinsToBonus?: number
    platformSlug: string
    gameId?: string
    sessionId?: string
  }): Promise<RecordUpdate[]> {
    const records = await this.getRecords()
    const updates: RecordUpdate[] = []
    const timestamp = Date.now()

    // Check biggest win
    if (sessionData.biggestWin !== undefined) {
      if (!records.biggestWin || sessionData.biggestWin > records.biggestWin.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.biggestWin,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'biggestWin',
          newRecord,
          previousRecord: records.biggestWin,
        })
        records.biggestWin = newRecord
      }
    }

    // Check highest RTP
    if (sessionData.rtp !== undefined) {
      if (!records.highestRTP || sessionData.rtp > records.highestRTP.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.rtp,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'highestRTP',
          newRecord,
          previousRecord: records.highestRTP,
        })
        records.highestRTP = newRecord
      }
    }

    // Check longest session
    if (sessionData.durationMinutes !== undefined) {
      if (!records.longestSession || sessionData.durationMinutes > records.longestSession.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.durationMinutes,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'longestSession',
          newRecord,
          previousRecord: records.longestSession,
        })
        records.longestSession = newRecord
      }
    }

    // Check most spins
    if (sessionData.spinCount !== undefined) {
      if (!records.mostSpins || sessionData.spinCount > records.mostSpins.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.spinCount,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'mostSpins',
          newRecord,
          previousRecord: records.mostSpins,
        })
        records.mostSpins = newRecord
      }
    }

    // Check biggest profit
    if (sessionData.netResult !== undefined) {
      if (!records.biggestProfit || sessionData.netResult > records.biggestProfit.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.netResult,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'biggestProfit',
          newRecord,
          previousRecord: records.biggestProfit,
        })
        records.biggestProfit = newRecord
      }
    }

    // Check fastest bonus
    if (sessionData.spinsToBonus !== undefined) {
      if (!records.fastestBonus || sessionData.spinsToBonus < records.fastestBonus.value) {
        const newRecord: PersonalRecord = {
          value: sessionData.spinsToBonus,
          timestamp,
          platformSlug: sessionData.platformSlug,
          gameId: sessionData.gameId,
          sessionId: sessionData.sessionId,
        }
        updates.push({
          recordType: 'fastestBonus',
          newRecord,
          previousRecord: records.fastestBonus,
        })
        records.fastestBonus = newRecord
      }
    }

    if (updates.length > 0) {
      await this.saveRecords(records)
      log.info(`Updated ${updates.length} personal record(s)`)
    }

    return updates
  }

  async getRecords(): Promise<PersonalRecords> {
    const stored = await storage.get(this.STORAGE_KEY)
    
    if (stored) {
      return stored as PersonalRecords
    }

    return {
      biggestWin: null,
      highestRTP: null,
      longestSession: null,
      mostSpins: null,
      biggestProfit: null,
      fastestBonus: null,
    }
  }

  private async saveRecords(records: PersonalRecords): Promise<void> {
    await storage.set(this.STORAGE_KEY, records)
  }

  async getRecordsSummary(): Promise<{
    totalRecords: number
    recentRecords: RecordUpdate[]
  }> {
    const records = await this.getRecords()
    const totalRecords = Object.values(records).filter(r => r !== null).length

    return {
      totalRecords,
      recentRecords: [], // Could track recent updates separately
    }
  }
}

export const recordsTracker = new RecordsTracker()
