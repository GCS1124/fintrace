import { describe, expect, it } from 'vitest'
import { handleAnalyze, type AnalyzeApiResponse, type AnalyzeSuccessResponse } from '../../api/analyze'
import { canonicalTransactions } from './fixtures'

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

describe('FINTRACE analysis API', () => {
  it('rejects invalid normalized records before running the graph engine', async () => {
    const harness = responseHarness()
    await handleAnalyze({
      method: 'POST',
      body: { transactions: [{ id: 'bad', timestampMs: 'tomorrow' }], asOfMs: null },
    }, harness.response)

    expect(harness.statusCode).toBe(400)
    expect(harness.payload).toMatchObject({ ok: false, error: 'Invalid transaction payload.' })
  })

  it('returns a cutoff-aware snapshot and server graph intelligence for canonical data', async () => {
    const harness = responseHarness()
    await handleAnalyze({
      method: 'POST',
      body: {
        transactions: canonicalTransactions,
        asOfMs: Date.parse('2026-09-18T10:06:30+05:30'),
        focalAccountId: 'A101',
      },
    }, harness.response)

    expect(harness.statusCode).toBe(200)
    expect(harness.headers['Cache-Control']).toBe('no-store, max-age=0')
    const payload = harness.payload as AnalyzeSuccessResponse
    expect(payload.ok).toBe(true)
    expect(payload.engineVersion).toBe('fintrace-graph-v2')
    expect(payload.snapshot.cases[0]?.score).toBe(100)
    expect(payload.intelligenceByAccount.A101.maxPathDepth).toBe(2)
    expect(payload.intelligenceByAccount.A101.paths[0]?.transactionIds).toEqual(['T009', 'T011'])
  })

  it('accepts null as the explicit before-first-transfer cutoff', async () => {
    const harness = responseHarness()
    await handleAnalyze({
      method: 'POST',
      body: { transactions: [canonicalTransactions[0]], asOfMs: null },
    }, harness.response)

    expect(harness.statusCode).toBe(200)
    expect((harness.payload as AnalyzeSuccessResponse).asOfMs).toBeNull()
    expect((harness.payload as AnalyzeSuccessResponse).snapshot.visibleTransactions).toEqual([])
  })
})
