import { describe, expect, it } from 'vitest'
import { DETECTOR_CONFIG } from '../config/detector'
import { analyzeSnapshot } from '../engine/analyze'
import { enrichSnapshot } from '../engine/intelligentAnalyze'
import { buildCaseExport, sanitiseFilename } from '../export/buildCaseExport'
import { canonicalTransactions } from './fixtures'

describe('FINTRACE case export', () => {
  it('exports only the current cutoff evidence and includes rule configuration and limitations', () => {
    const snapshot = analyzeSnapshot(canonicalTransactions, Date.parse('2026-09-18T10:04:30+05:30'), DETECTOR_CONFIG)
    const intelligence = enrichSnapshot(snapshot, DETECTOR_CONFIG).A101
    const payload = buildCaseExport(
      snapshot,
      'A101',
      { sourceLabel: 'Split and reconverge', sourceKind: 'synthetic', loadedTransactionCount: 12 },
      '<script>alert(1)</script>',
      intelligence,
    )
    expect(payload.schemaVersion).toBe('fintrace-case-v1')
    expect(payload.detectorVersion).toBe('fintrace-rules-v1')
    expect(payload.displayTimezone).toBe('Asia/Kolkata')
    expect(payload.ruleConfiguration).toEqual(DETECTOR_CONFIG)
    expect(payload.investigation.score).toBe(70)
    expect(payload.investigation.supportingTransactions.map((transaction) => transaction.id)).not.toContain('T011')
    expect(payload.investigation.sessionNote.text).toBe('<script>alert(1)</script>')
    expect(payload.investigation.graphIntelligence?.engineVersion).toBe('fintrace-graph-v2')
    expect(payload.investigation.supportingTransactions.map((transaction) => transaction.id)).toContain('T010')
    expect(payload.limitations.join(' ')).toContain('not proof of fraud')
  })

  it('sanitises account IDs for download filenames', () => {
    expect(sanitiseFilename('A101 / suspicious')).toBe('A101-suspicious')
    expect(sanitiseFilename('///')).toBe('account')
  })
})
