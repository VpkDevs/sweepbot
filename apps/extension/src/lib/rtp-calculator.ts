/**
 * RTP (Return to Player) calculator.
 * Computes real-time RTP from transaction stream.
 */

export interface RtpStats {
  totalWagered: number
  totalWon: number
  rtp: number
  spinCount: number
  winCount: number
  lossCount: number
  largestWin: number
  largestLoss: number
  volatility: 'low' | 'medium' | 'high'
  confidenceLevel: 'low' | 'medium' | 'high'
}

class RtpCalculator {
  private wagered = 0
  private won = 0
  private spins = 0
  private wins = 0
  private losses = 0
  private largestWin = 0
  private largestLoss = 0
  private spinResults: Array<{ bet: number; win: number }> = []

  /**
   * Record a spin result
   */
  recordSpin(betAmount: number, winAmount: number): void {
    this.wagered += betAmount
    this.won += winAmount
    this.spins += 1
    this.spinResults.push({ bet: betAmount, win: winAmount })

    if (winAmount > betAmount) {
      this.wins += 1
      this.largestWin = Math.max(this.largestWin, winAmount - betAmount)
    } else if (winAmount < betAmount) {
      this.losses += 1
      this.largestLoss = Math.max(this.largestLoss, betAmount - winAmount)
    }

    // Keep only last 500 spins for memory efficiency
    if (this.spinResults.length > 500) {
      this.spinResults.shift()
    }
  }

  /**
   * Calculate current RTP and stats
   */
  calculate(): RtpStats {
    const rtp = this.wagered > 0 ? (this.won / this.wagered) * 100 : 0
    const volatility = this.calculateVolatility()
    const confidenceLevel = this.getConfidenceLevel()

    return {
      totalWagered: this.wagered,
      totalWon: this.won,
      rtp: Math.round(rtp * 100) / 100, // 2 decimals
      spinCount: this.spins,
      winCount: this.wins,
      lossCount: this.losses,
      largestWin: this.largestWin,
      largestLoss: this.largestLoss,
      volatility,
      confidenceLevel,
    }
  }

  /**
   * Calculate volatility from spin results
   */
  private calculateVolatility(): 'low' | 'medium' | 'high' {
    if (this.spins < 10) return 'low' // Not enough data

    const mean = this.wagered / this.spins
    const variance =
      this.spinResults.reduce((sum, { bet, win }) => {
        const netResult = win - bet
        return sum + Math.pow(netResult - 0, 2) // 0 is expected value
      }, 0) / this.spins

    const stdDev = Math.sqrt(variance)
    const cv = stdDev / mean // Coefficient of variation

    if (cv < 1) return 'low'
    if (cv < 2) return 'medium'
    return 'high'
  }

  /**
   * Determine confidence level based on sample size
   */
  private getConfidenceLevel(): 'low' | 'medium' | 'high' {
    if (this.spins < 100) return 'low'
    if (this.spins < 500) return 'medium'
    return 'high'
  }

  /**
   * Reset calculator
   */
  reset(): void {
    this.wagered = 0
    this.won = 0
    this.spins = 0
    this.wins = 0
    this.losses = 0
    this.largestWin = 0
    this.largestLoss = 0
    this.spinResults = []
  }

  /**
   * Export data for persistence
   */
  export(): {
    wagered: number
    won: number
    spins: number
    spinResults: Array<{ bet: number; win: number }>
  } {
    return {
      wagered: this.wagered,
      won: this.won,
      spins: this.spins,
      spinResults: [...this.spinResults],
    }
  }

  /**
   * Import data from persistence
   */
  import(data: {
    wagered: number
    won: number
    spins: number
    spinResults: Array<{ bet: number; win: number }>
  }): void {
    this.wagered = data.wagered
    this.won = data.won
    this.spins = data.spins
    this.spinResults = [...data.spinResults]

    // Recalculate derived fields
    this.wins = 0
    this.losses = 0
    this.largestWin = 0
    this.largestLoss = 0

    for (const { bet, win } of this.spinResults) {
      if (win > bet) {
        this.wins += 1
        this.largestWin = Math.max(this.largestWin, win - bet)
      } else if (win < bet) {
        this.losses += 1
        this.largestLoss = Math.max(this.largestLoss, bet - win)
      }
    }
  }
}

/**
 * Global RTP calculator instance
 */
export const rtpCalculator = new RtpCalculator()
