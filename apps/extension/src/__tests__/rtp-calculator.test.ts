import { RtpCalculator } from '../lib/rtp-calculator'

describe('RtpCalculator', () => {
  let calc: RtpCalculator

  beforeEach(() => {
    calc = new RtpCalculator()
  })

  it('starts with zeros', () => {
    const stats = calc.calculate()
    expect(stats.totalWagered).toBe(0)
    expect(stats.totalWon).toBe(0)
    expect(stats.rtp).toBe(0)
    expect(stats.spinCount).toBe(0)
    expect(stats.volatility).toBe('low')
    expect(stats.confidenceLevel).toBe('low')
  })

  it('records wins and losses correctly', () => {
    calc.recordSpin(10, 20) // win
    calc.recordSpin(5, 0) // loss
    const stats = calc.calculate()
    expect(stats.totalWagered).toBe(15)
    expect(stats.totalWon).toBe(20)
    expect(stats.rtp).toBeCloseTo((20 / 15) * 100, 2)
    expect(stats.spinCount).toBe(2)
    expect(stats.winCount).toBe(1)
    expect(stats.lossCount).toBe(1)
    expect(stats.largestWin).toBe(10)
    expect(stats.largestLoss).toBe(5)
  })

  it('calculates volatility categories', () => {
    // low variance spins
    for (let i = 0; i < 20; i++) {
      calc.recordSpin(10, 10)
    }
    expect(calc.calculate().volatility).toBe('low')

    // clear high variance: large jackpot occasional
    calc = new RtpCalculator()
    for (let i = 0; i < 100; i++) {
      const bet = 10
      const win = i === 50 ? 1000 : 0
      calc.recordSpin(bet, win)
    }
    expect(calc.calculate().volatility).toBe('high')
  })

  it('confidence levels scale with spins', () => {
    calc = new RtpCalculator()
    for (let i = 0; i < 50; i++) calc.recordSpin(1, 1)
    expect(calc.calculate().confidenceLevel).toBe('low')
    for (let i = 0; i < 100; i++) calc.recordSpin(1, 1)
    expect(calc.calculate().confidenceLevel).toBe('medium')
    for (let i = 0; i < 500; i++) calc.recordSpin(1, 1)
    expect(calc.calculate().confidenceLevel).toBe('high')
  })

  it('export and import maintain state', () => {
    calc.recordSpin(10, 5)
    calc.recordSpin(5, 0)
    const data = calc.export()
    const newCalc = new RtpCalculator()
    newCalc.import(data)
    expect(newCalc.calculate()).toEqual(calc.calculate())
  })
})