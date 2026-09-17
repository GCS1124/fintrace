import { describe, expect, it } from 'vitest'
import { DETECTOR_CONFIG } from '../config/detector'
import { analyzeSnapshot } from '../engine/analyze'
import { analyzeFlowIntelligence, enrichSnapshot } from '../engine/intelligentAnalyze'
import { ambiguousTransactions, canonicalTransactions, makeCollectionBase, makeTransaction } from './fixtures'

const at = (timestamp: string) => Date.parse(timestamp)

describe('FINTRACE graph intelligence', () => {
  it('traces the canonical two-branch flow with bottleneck amounts and no false cycle', () => {
    const snapshot = analyzeSnapshot(canonicalTransactions, at('2026-09-18T10:06:30+05:30'), DETECTOR_CONFIG)
    const intelligence = enrichSnapshot(snapshot, DETECTOR_CONFIG).A101

    expect(intelligence.engineVersion).toBe('fintrace-graph-v2')
    expect(intelligence.maxPathDepth).toBe(2)
    expect(intelligence.observedPathCount).toBe(2)
    expect(intelligence.cycleCount).toBe(0)
    expect(intelligence.observedFlowPaise).toBe(3_700_000)
    expect(intelligence.velocityTransactionCount).toBe(12)
    expect(intelligence.signals.find((signal) => signal.id === 'velocity')?.status).toBe('observed')
    expect(intelligence.signals.find((signal) => signal.id === 'fan_out')?.status).toBe('not_observed')
    expect(intelligence.paths.map((path) => path.accountIds)).toEqual([
      ['A101', 'A201', 'A301'],
      ['A101', 'A202', 'A301'],
    ])
  })

  it('keeps future branches out of the trace at a mid-replay cutoff', () => {
    const snapshot = analyzeSnapshot(canonicalTransactions, at('2026-09-18T10:04:30+05:30'), DETECTOR_CONFIG)
    const intelligence = enrichSnapshot(snapshot, DETECTOR_CONFIG).A101

    expect(intelligence.observedPathCount).toBe(0)
    expect(intelligence.maxPathDepth).toBe(0)
    expect(intelligence.paths.flatMap((path) => path.transactionIds)).not.toContain('T011')
  })

  it('observes a three-hop chronological layering path', () => {
    const transactions = [
      ...makeCollectionBase('LAYER', '2026-09-18T09:00:00+05:30', 'Y', 10_000),
      makeTransaction('L-1', '2026-09-18T09:04:00+05:30', 'LAYER', 'L2', 48_000),
      makeTransaction('L-2', '2026-09-18T09:05:00+05:30', 'L2', 'L3', 47_000),
      makeTransaction('L-3', '2026-09-18T09:06:00+05:30', 'L3', 'L4', 46_000),
    ]
    const snapshot = analyzeSnapshot(transactions, at('2026-09-18T09:06:00+05:30'), DETECTOR_CONFIG)
    const selectedCase = snapshot.cases.find((item) => item.focalAccountId === 'LAYER')
    const intelligence = selectedCase ? analyzeFlowIntelligence(snapshot.visibleTransactions, selectedCase, snapshot.asOfMs, DETECTOR_CONFIG) : undefined

    expect(intelligence?.maxPathDepth).toBe(3)
    expect(intelligence?.signals.find((signal) => signal.id === 'layering')?.status).toBe('observed')
    expect(intelligence?.paths[0]?.transactionIds).toEqual(['L-1', 'L-2', 'L-3'])
  })

  it('detects chronological circular re-entry without following repeated nodes forever', () => {
    const transactions = [
      ...makeCollectionBase('CYCLE', '2026-09-18T09:00:00+05:30', 'Z', 10_000),
      makeTransaction('C-1', '2026-09-18T09:04:00+05:30', 'CYCLE', 'C2', 48_000),
      makeTransaction('C-2', '2026-09-18T09:05:00+05:30', 'C2', 'C3', 47_000),
      makeTransaction('C-3', '2026-09-18T09:06:00+05:30', 'C3', 'CYCLE', 46_000),
    ]
    const snapshot = analyzeSnapshot(transactions, at('2026-09-18T09:06:00+05:30'), DETECTOR_CONFIG)
    const selectedCase = snapshot.cases.find((item) => item.focalAccountId === 'CYCLE')
    const intelligence = selectedCase ? analyzeFlowIntelligence(snapshot.visibleTransactions, selectedCase, snapshot.asOfMs, DETECTOR_CONFIG) : undefined

    expect(intelligence?.cycleCount).toBe(1)
    expect(intelligence?.signals.find((signal) => signal.id === 'circular')?.status).toBe('observed')
    expect(intelligence?.paths[0]?.accountIds).toEqual(['CYCLE', 'C2', 'C3', 'CYCLE'])
  })

  it('does not silently whitelist an ambiguous pattern', () => {
    const snapshot = analyzeSnapshot(ambiguousTransactions, at('2026-09-18T14:07:31+05:30'), DETECTOR_CONFIG)
    const intelligence = enrichSnapshot(snapshot, DETECTOR_CONFIG).L101
    expect(intelligence.riskScore).toBe(100)
    expect(snapshot.cases.find((item) => item.focalAccountId === 'L101')?.score).toBe(100)
  })
})
