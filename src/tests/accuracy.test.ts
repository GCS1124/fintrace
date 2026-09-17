import { describe, expect, it } from 'vitest'
import { handleAnalyze, type AnalyzeApiResponse, type AnalyzeSuccessResponse } from '../../api/analyze'
import { ACCURACY_SCENARIOS } from './accuracyScenarios'

function responseHarness() {
  let statusCode = 200
  let payload: unknown
  const headers: Record<string, string> = {}
  const response: AnalyzeApiResponse = {
    setHeader: (name, value) => { headers[name] = value },
    status: (code) => {
      statusCode = code
      return response
    },
    json: (nextPayload) => { payload = nextPayload },
  }
  return { response, get statusCode() { return statusCode }, get payload() { return payload }, headers }
}

describe('FINTRACE 25-scenario backend accuracy matrix', () => {
  for (const scenario of ACCURACY_SCENARIOS) {
    it(`${scenario.id} · ${scenario.label}`, async () => {
      const harness = responseHarness()
      await handleAnalyze({
        method: 'POST',
        body: {
          transactions: scenario.transactions,
          asOfMs: scenario.asOfMs,
          focalAccountId: scenario.focalAccountId,
        },
      }, harness.response)

      expect(harness.statusCode).toBe(200)
      expect(harness.headers['Cache-Control']).toBe('no-store, max-age=0')

      const payload = harness.payload as AnalyzeSuccessResponse
      expect(payload.ok).toBe(true)
      expect(payload.engineVersion).toBe('fintrace-graph-v2')
      expect(payload.asOfMs).toBe(scenario.asOfMs)
      expect(payload.snapshot.visibleTransactions.every((transaction) => transaction.timestampMs <= scenario.asOfMs)).toBe(true)
      expect(new Set(payload.snapshot.visibleTransactions.map((transaction) => transaction.id)).size)
        .toBe(payload.snapshot.visibleTransactions.length)

      const selectedCase = payload.snapshot.cases.find((item) => item.focalAccountId === scenario.focalAccountId)
      const expected = scenario.expected
      if (expected.score === 0) {
        expect(selectedCase).toBeUndefined()
        expect(payload.intelligenceByAccount[scenario.focalAccountId]).toBeUndefined()
        return
      }

      expect(selectedCase?.score).toBe(expected.score)
      expect(selectedCase?.priority).toBe(expected.score === 100 ? 'high' : expected.score === 70 ? 'review' : 'monitor')
      expect(selectedCase?.signals.find((signal) => signal.id === 'forwarding')?.status).toBe(expected.forwardingStatus)
      expect(selectedCase?.signals.find((signal) => signal.id === 'reconvergence')?.status).toBe(expected.reconvergenceStatus)

      const intelligence = payload.intelligenceByAccount[scenario.focalAccountId]
      expect(intelligence?.engineVersion).toBe('fintrace-graph-v2')
      if (expected.expectedPathCount !== undefined) expect(intelligence?.observedPathCount).toBe(expected.expectedPathCount)
      if (expected.expectedPathDepth !== undefined) expect(intelligence?.maxPathDepth).toBe(expected.expectedPathDepth)
      if (expected.expectedCycleCount !== undefined) expect(intelligence?.cycleCount).toBe(expected.expectedCycleCount)
      if (expected.expectedVelocityTransactionCount !== undefined) {
        expect(intelligence?.velocityTransactionCount).toBe(expected.expectedVelocityTransactionCount)
      }
      if (expected.witnessDestination !== undefined) {
        expect(selectedCase?.reconvergenceWitness?.destinationAccountId).toBe(expected.witnessDestination)
      }
      if (expected.warningSubstring !== undefined) {
        expect(selectedCase?.warnings.join(' ')).toContain(expected.warningSubstring)
      }

      for (const signalId of expected.observedSignals ?? []) {
        expect(intelligence?.signals.find((signal) => signal.id === signalId)?.status).toBe('observed')
      }
      for (const signalId of expected.notObservedSignals ?? []) {
        expect(intelligence?.signals.find((signal) => signal.id === signalId)?.status).toBe('not_observed')
      }
      for (const transactionId of expected.notVisibleTransactionIds ?? []) {
        expect(payload.snapshot.visibleTransactions.map((transaction) => transaction.id)).not.toContain(transactionId)
      }
      for (const transactionId of expected.excludedTransactionIds ?? []) {
        expect(intelligence?.paths.flatMap((path) => path.transactionIds)).not.toContain(transactionId)
      }
    })
  }
})
