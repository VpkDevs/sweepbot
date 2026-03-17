import {
  analyzePlatformCapture,
  buildPlatformCaptureExport,
  type PlatformCaptureSnapshot,
} from '../lib/platform-capture'

describe('platform capture analysis', () => {
  const snapshot: PlatformCaptureSnapshot = {
    version: 1,
    active: true,
    startedAt: 1,
    updatedAt: 2,
    pageUrls: ['https://examplecasino.com/play/book-of-gold'],
    requests: [
      {
        id: 'balance-1',
        kind: 'fetch',
        method: 'GET',
        status: 200,
        url: 'https://api.examplecasino.com/account/balance',
        pageUrl: 'https://examplecasino.com/lobby',
        timestamp: 2,
        responseJson: { data: { sweeps_coins: 12.5, gold_coins: 5000 } },
      },
      {
        id: 'tx-1',
        kind: 'xhr',
        method: 'POST',
        status: 200,
        url: 'https://api.examplecasino.com/game/spin',
        pageUrl: 'https://examplecasino.com/play/book-of-gold',
        timestamp: 3,
        responseJson: {
          data: { bet: 1, payout: 4, game_id: 'book-of-gold', round_id: 'round-123' },
        },
      },
    ],
  }

  it('finds likely balance and transaction candidates', () => {
    const analysis = analyzePlatformCapture(snapshot)
    expect(analysis.balanceCandidates[0]?.suggestedPaths).toMatchObject({
      scPath: 'data.sweeps_coins',
      gcPath: 'data.gold_coins',
    })
    expect(analysis.transactionCandidates[0]?.suggestedPaths).toMatchObject({
      betAmountPath: 'data.bet',
      winAmountPath: 'data.payout',
      gameIdPath: 'data.game_id',
      roundIdPath: 'data.round_id',
    })
  })

  it('builds a copyable export payload', () => {
    const report = buildPlatformCaptureExport(
      'https://examplecasino.com/play/book-of-gold',
      snapshot
    )
    expect(report.captureType).toBe('sweepbot-platform-onboarding')
    expect(report.snapshot?.requests).toHaveLength(2)
    expect(report.analysis.transactionCandidates).toHaveLength(1)
  })
})
