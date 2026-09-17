import { describe, expect, it } from 'vitest'
import { DETECTOR_CONFIG } from '../config/detector'
import { analyzeSnapshot } from '../engine/analyze'
import { ambiguousTransactions, canonicalTransactions, makeCollectionBase, makeTransaction, merchantTransactions } from './fixtures'

const at = (timestamp: string) => Date.parse(timestamp)
const caseFor = (transactions: readonly ReturnType<typeof makeTransaction>[], cutoff: number, account = 'A101') =>
  analyzeSnapshot(transactions, cutoff, DETECTOR_CONFIG).cases.find((item) => item.focalAccountId === account)

describe('FINTRACE detector', () => {
  it('scores the canonical fixture 30 -> 70 -> 100 at the specified cutoffs', () => {
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:02:00+05:30'))?.score).toBe(30)
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:04:00+05:30'))?.score).toBe(30)
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:04:30+05:30'))?.score).toBe(70)
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:06:00+05:30'))?.score).toBe(70)
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:06:30+05:30'))?.score).toBe(100)
  })

  it('uses the latest equal-scored collection anchor and records the four-edge witness', () => {
    const result = caseFor(canonicalTransactions, at('2026-09-18T10:06:30+05:30'))
    expect(result?.anchorMs).toBe(at('2026-09-18T10:02:00+05:30'))
    expect(result?.incomingPaise).toBe(4_000_000)
    expect(result?.outgoingPaise).toBe(3_800_000)
    expect(result?.reconvergenceWitness).toEqual({
      destinationAccountId: 'A301',
      firstHopTransactionId: 'T009',
      secondHopTransactionId: 'T010',
      firstOnwardTransactionId: 'T011',
      secondOnwardTransactionId: 'T012',
    })
    expect(result?.evidenceTransactionIds).toEqual(expect.arrayContaining(['T001', 'T008', 'T009', 'T010', 'T011', 'T012']))
  })

  it('does not produce a candidate before six distinct senders are visible', () => {
    expect(caseFor(canonicalTransactions, at('2026-09-18T10:01:20+05:30'))).toBeUndefined()
  })

  it('keeps the merchant collection at Monitor 30 without a rapid supplier payment', () => {
    const result = caseFor(merchantTransactions, at('2026-09-18T12:30:00+05:30'), 'A501')
    expect(result?.score).toBe(30)
    expect(result?.priority).toBe('monitor')
    expect(result?.signals.find((signal) => signal.id === 'forwarding')?.status).toBe('not_observed')
    expect(result?.warnings.join(' ')).toContain('Pattern evidence is not proof of fraud.')
  })

  it('does not whitelist the intentionally ambiguous equivalent pattern', () => {
    const result = caseFor(ambiguousTransactions, at('2026-09-18T14:07:31+05:30'), 'L101')
    expect(result?.score).toBe(100)
    expect(result?.priority).toBe('high')
  })

  it('respects the six-sender collection boundary', () => {
    const base = makeCollectionBase()
    expect(analyzeSnapshot(base.slice(0, 5), at('2026-09-18T09:02:00+05:30'), DETECTOR_CONFIG).cases).toHaveLength(0)
    expect(analyzeSnapshot(base, at('2026-09-18T09:02:00+05:30'), DETECTOR_CONFIG).cases[0]?.score).toBe(30)
  })

  it('respects the exact 79.99% and 80% forwarding boundary with integer paise', () => {
    const base = makeCollectionBase('BOUNDARY', '2026-09-18T09:00:00+05:30', 'B', 10_000)
    const below = [...base, makeTransaction('OUT-BELOW', '2026-09-18T09:04:00+05:30', 'BOUNDARY', 'BENE-1', 47_994)]
    const atThreshold = [...base, makeTransaction('OUT-AT', '2026-09-18T09:04:00+05:30', 'BOUNDARY', 'BENE-1', 48_000)]
    expect(caseFor(below, at('2026-09-18T09:04:00+05:30'), 'BOUNDARY')?.score).toBe(30)
    expect(caseFor(atThreshold, at('2026-09-18T09:04:00+05:30'), 'BOUNDARY')?.score).toBe(70)
  })

  it('includes an outward transfer exactly five minutes after anchor but excludes one millisecond later', () => {
    const base = makeCollectionBase('TIME', '2026-09-18T09:00:00+05:30', 'T', 10_000)
    const exact = [...base, makeTransaction('OUT-EXACT', '2026-09-18T09:06:40+05:30', 'TIME', 'BENE-1', 48_000)]
    const late = [...base, makeTransaction('OUT-LATE', '2026-09-18T09:06:40.001+05:30', 'TIME', 'BENE-1', 48_000)]
    expect(caseFor(exact, at('2026-09-18T09:06:40+05:30'), 'TIME')?.score).toBe(70)
    expect(caseFor(late, at('2026-09-18T09:06:40.001+05:30'), 'TIME')?.score).toBe(30)
  })

  it('requires strict downstream chronology and includes exactly ten minutes but not ten minutes plus one millisecond', () => {
    const base = makeCollectionBase('HOP', '2026-09-18T09:00:00+05:30', 'H', 10_000)
    const firstHopAt = '2026-09-18T09:06:40+05:30'
    const exact = [
      ...base,
      makeTransaction('HOP-A', firstHopAt, 'HOP', 'BRANCH-A', 24_000),
      makeTransaction('HOP-B', firstHopAt, 'HOP', 'BRANCH-B', 24_000),
      makeTransaction('HOP-C', '2026-09-18T09:16:40+05:30', 'BRANCH-A', 'COMMON', 1_000),
      makeTransaction('HOP-D', '2026-09-18T09:16:40+05:30', 'BRANCH-B', 'COMMON', 1_000),
    ]
    const late = exact.map((transaction) => transaction.id === 'HOP-D'
      ? { ...transaction, timestampMs: at('2026-09-18T09:16:40.001+05:30') }
      : transaction)
    expect(caseFor(exact, at('2026-09-18T09:16:40+05:30'), 'HOP')?.score).toBe(100)
    expect(caseFor(late, at('2026-09-18T09:16:40.001+05:30'), 'HOP')?.score).toBe(70)
  })

  it('does not count outward movement at or before the collection anchor', () => {
    const base = makeCollectionBase('CHRONO', '2026-09-18T09:00:00+05:30', 'C', 10_000)
    const transactions = [...base, makeTransaction('OUT-SAME', '2026-09-18T09:01:40+05:30', 'CHRONO', 'BENE-1', 48_000)]
    expect(caseFor(transactions, at('2026-09-18T09:02:00+05:30'), 'CHRONO')?.score).toBe(30)
  })

  it('requires two distinct outward branches, not two onward payments from one intermediary', () => {
    const base = makeCollectionBase('BRANCH', '2026-09-18T09:00:00+05:30', 'R', 10_000)
    const transactions = [
      ...base,
      makeTransaction('BRANCH-A', '2026-09-18T09:04:00+05:30', 'BRANCH', 'SAME', 48_000),
      makeTransaction('BRANCH-B', '2026-09-18T09:06:00+05:30', 'SAME', 'COMMON', 1_000),
      makeTransaction('BRANCH-C', '2026-09-18T09:06:30+05:30', 'SAME', 'COMMON', 1_000),
    ]
    expect(caseFor(transactions, at('2026-09-18T09:06:30+05:30'), 'BRANCH')?.score).toBe(70)
  })

  it('shows ratios above 100% honestly and emits an attribution warning', () => {
    const base = makeCollectionBase('OVER', '2026-09-18T09:00:00+05:30', 'O', 10_000)
    const result = caseFor([...base, makeTransaction('OUT-OVER', '2026-09-18T09:04:00+05:30', 'OVER', 'BENE-1', 90_000)], at('2026-09-18T09:04:00+05:30'), 'OVER')
    expect(result?.score).toBe(70)
    expect(result?.signals.find((signal) => signal.id === 'forwarding')?.observed.observedOutflowPercent).toBe('150%')
    expect(result?.warnings.join(' ')).toContain('exceeds the collection volume')
  })

  it('is deterministic for reordered rows and does not mutate input transactions', () => {
    const input = [...canonicalTransactions]
    const before = JSON.stringify(input)
    const shuffled = [...input].reverse()
    const first = caseFor(input, at('2026-09-18T10:06:30+05:30'))
    const second = caseFor(shuffled, at('2026-09-18T10:06:30+05:30'))
    expect(second?.score).toBe(first?.score)
    expect(second?.evidenceTransactionIds).toEqual(first?.evidenceTransactionIds)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('returns an empty queue for a normal dataset without a qualifying burst', () => {
    const normal = [
      makeTransaction('N1', '2026-09-18T09:00:00+05:30', 'CUSTOMER-1', 'SHOP-1', 1_000),
      makeTransaction('N2', '2026-09-18T09:01:00+05:30', 'CUSTOMER-2', 'SHOP-1', 1_000),
    ]
    expect(analyzeSnapshot(normal, at('2026-09-18T09:05:00+05:30'), DETECTOR_CONFIG).cases).toEqual([])
  })
})
