/**
 * Session Streak Tracker
 * Tracks consecutive days of platform activity and rewards consistency
 */

import { storage } from './storage'
import { createLogger } from './logger'

const log = createLogger('StreakTracker')

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastSessionDate: string // ISO date string
  totalSessions: number
  streakMilestones: number[] // [7, 30, 100, 365]
}

export interface StreakUpdate {
  streakData: StreakData
  isNewDay: boolean
  streakBroken: boolean
  milestoneReached?: number
}

class StreakTracker {
  private readonly STORAGE_KEY = 'sessionStreak' as const

  async recordSession(platformSlug: string): Promise<StreakUpdate> {
    const today = this.getTodayDateString()
    const streakData = await this.getStreakData()
    
    const lastDate = streakData.lastSessionDate
    const isNewDay = lastDate !== today
    const streakBroken = this.isStreakBroken(lastDate, today)

    if (!isNewDay) {
      // Same day, no streak update
      return {
        streakData,
        isNewDay: false,
        streakBroken: false,
      }
    }

    // New day
    const previousStreak = streakData.currentStreak
    
    if (streakBroken) {
      // Streak broken, reset to 1
      streakData.currentStreak = 1
      log.info(`Streak broken for ${platformSlug}. Resetting to 1.`)
    } else {
      // Consecutive day
      streakData.currentStreak += 1
      log.info(`Streak continued: ${streakData.currentStreak} days`)
    }

    streakData.lastSessionDate = today
    streakData.totalSessions += 1
    
    if (streakData.currentStreak > streakData.longestStreak) {
      streakData.longestStreak = streakData.currentStreak
    }

    await this.saveStreakData(streakData)

    // Check for milestone
    const milestoneReached = this.checkMilestone(previousStreak, streakData.currentStreak)

    return {
      streakData,
      isNewDay: true,
      streakBroken,
      milestoneReached,
    }
  }

  async getStreakData(): Promise<StreakData> {
    const stored = await storage.get(this.STORAGE_KEY)
    
    if (stored) {
      return stored as StreakData
    }

    // Initialize
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastSessionDate: '',
      totalSessions: 0,
      streakMilestones: [7, 30, 100, 365],
    }
  }

  private async saveStreakData(data: StreakData): Promise<void> {
    await storage.set(this.STORAGE_KEY, data)
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  }

  private isStreakBroken(lastDate: string, today: string): boolean {
    if (!lastDate) return false // First session ever

    const last = new Date(lastDate)
    const current = new Date(today)
    const diffMs = current.getTime() - last.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Streak broken if more than 1 day gap
    return diffDays > 1
  }

  private checkMilestone(previousStreak: number, currentStreak: number): number | undefined {
    const milestones = [7, 30, 100, 365]
    
    for (const milestone of milestones) {
      if (currentStreak >= milestone && previousStreak < milestone) {
        return milestone
      }
    }
    
    return undefined
  }

  async getStreakStats(): Promise<{
    current: number
    longest: number
    nextMilestone: number | null
    daysUntilMilestone: number | null
  }> {
    const data = await this.getStreakData()
    const milestones = [7, 30, 100, 365]
    
    const nextMilestone = milestones.find(m => m > data.currentStreak) ?? null
    const daysUntilMilestone = nextMilestone ? nextMilestone - data.currentStreak : null

    return {
      current: data.currentStreak,
      longest: data.longestStreak,
      nextMilestone,
      daysUntilMilestone,
    }
  }
}

export const streakTracker = new StreakTracker()
