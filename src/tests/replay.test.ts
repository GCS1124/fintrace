import { describe, expect, it } from 'vitest'
import { DETECTOR_CONFIG } from '../config/detector'
import { analyzeSnapshot } from '../engine/analyze'
import { canonicalTransactions, makeTransaction } from './fixtures'

const at = (timestamp: string) => Date.parse(timestamp)

describe('FINTRACE replay snapshots', () => {
  it('removes future branch evidence when rewinding from the final fixture', () => {
    const snapshot = analyzeSnapshot(canonicalTransactions, at('2026-09-18T10:04:00+05:30'), DETECTOR_CONFIG)
    const focalCase = snapshot.cases.find((item) => item.focalAccountId === 'A101')
    expect(snapshot.visibleTransactions.map((transaction) => transaction.id)).not.toContain('T010')
    expect(snapshot.visibleTransactions.map((transaction) => transaction.id)).not.toContain('T011')
    expect(focalCase?.score).toBe(30)
    expect(focalCase?.evidenceTransactionIds).not.toContain('T010')
    expect(focalCase?.evidenceTransactionIds).not.toContain('T011')
  })

  it('treats multiple transfers at one timestamp as one replay step', () => {
    const transactions = [
      makeTransaction('S1', '2026-09-18T09:00:00+05:30', 'A', 'FOCAL', 100),
      makeTransaction('S2', '2026-09-18T09:00:00+05:30', 'B', 'FOCAL', 100),
      makeTransaction('S3', '2026-09-18T09:00:00+05:30', 'C', 'FOCAL', 100),
      makeTransaction('S4', '2026-09-18T09:00:00+05:30', 'D', 'FOCAL', 100),
      makeTransaction('S5', '2026-09-18T09:00:00+05:30', 'E', 'FOCAL', 100),
      makeTransaction('S6', '2026-09-18T09:00:00+05:30', 'F', 'FOCAL', 100),
      makeTransaction('O1', '2026-09-18T09:01:00+05:30', 'FOCAL', 'TARGET', 480),
      makeTransaction('O2', '2026-09-18T09:01:00+05:30', 'FOCAL', 'TARGET-2', 1),
    ]
    const snapshot = analyzeSnapshot(transactions, at('2026-09-18T09:01:00+05:30'), DETECTOR_CONFIG)
    expect(snapshot.visibleTransactions).toHaveLength(8)
    expect(snapshot.cases[0]?.score).toBe(70)
  })

  it('does not leak a future transaction into an earlier snapshot even when appended later', () => {
    const earlier = analyzeSnapshot(canonicalTransactions, at('2026-09-18T10:04:30+05:30'), DETECTOR_CONFIG)
    const appended = analyzeSnapshot(
      [...canonicalTransactions, makeTransaction('FUTURE', '2026-09-18T12:00:00+05:30', 'A101', 'FUTURE-ACCOUNT', 999_999)],
      at('2026-09-18T10:04:30+05:30'),
      DETECTOR_CONFIG,
    )
    expect(appended.visibleTransactions).toEqual(earlier.visibleTransactions)
    expect(appended.cases).toEqual(earlier.cases)
  })
})
