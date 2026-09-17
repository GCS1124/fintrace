import { DETECTOR_CONFIG, LIMITS } from '../src/config/detector.js'
import { analyzeIntelligentSnapshot } from '../src/engine/intelligentAnalyze.js'
import type { AnalysisSnapshot, FlowIntelligence, Transaction } from '../src/types.js'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/
const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024

export interface AnalyzeApiRequest {
  readonly method?: string
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, string | undefined>>
}

export interface AnalyzeApiResponse {
  setHeader(name: string, value: string): void
  status(code: number): AnalyzeApiResponse
  json(payload: unknown): void
}

export interface AnalyzeSuccessResponse {
  readonly ok: true
  readonly engineVersion: 'fintrace-graph-v2'
  readonly processedAt: string
  readonly asOfMs: number | null
  readonly snapshot: AnalysisSnapshot
  readonly intelligenceByAccount: Readonly<Record<string, FlowIntelligence>>
}

export interface AnalyzeErrorResponse {
  readonly ok: false
  readonly error: string
  readonly issues: readonly string[]
}

function sendJson(response: AnalyzeApiResponse, status: number, payload: AnalyzeSuccessResponse | AnalyzeErrorResponse): void {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.status(status).json(payload)
}

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false
  const transaction = value as Partial<Transaction>
  return (
    typeof transaction.id === 'string' &&
    ID_PATTERN.test(transaction.id) &&
    typeof transaction.timestampMs === 'number' &&
    Number.isFinite(transaction.timestampMs) &&
    typeof transaction.fromAccount === 'string' &&
    ID_PATTERN.test(transaction.fromAccount) &&
    typeof transaction.toAccount === 'string' &&
    ID_PATTERN.test(transaction.toAccount) &&
    transaction.fromAccount !== transaction.toAccount &&
    typeof transaction.amountPaise === 'number' &&
    Number.isSafeInteger(transaction.amountPaise) &&
    transaction.amountPaise > 0 &&
    transaction.amountPaise <= LIMITS.maxAmountPaise &&
    transaction.currency === 'INR'
  )
}

function validateTransactions(value: unknown): { readonly transactions: readonly Transaction[]; readonly issues: readonly string[] } {
  if (!Array.isArray(value)) return { transactions: [], issues: ['transactions must be an array.'] }
  if (value.length === 0) return { transactions: [], issues: ['At least one transaction is required.'] }
  if (value.length > LIMITS.maxTransactions) {
    return {
      transactions: [],
      issues: [`The request contains ${value.length.toLocaleString()} rows; the limit is ${LIMITS.maxTransactions.toLocaleString()}.`],
    }
  }

  const issues: string[] = []
  const seenIds = new Set<string>()
  value.forEach((candidate, index) => {
    if (!isTransaction(candidate)) {
      issues.push(`Transaction ${index + 1} is not a valid normalised INR record.`)
      return
    }
    if (seenIds.has(candidate.id)) issues.push(`Duplicate transaction ID: ${candidate.id}.`)
    seenIds.add(candidate.id)
  })
  return { transactions: issues.length > 0 ? [] : value, issues }
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

export async function handleAnalyze(request: AnalyzeApiRequest, response: AnalyzeApiResponse): Promise<void> {
  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, error: 'Method not allowed.', issues: ['Use POST with a JSON analysis request.'] })
    return
  }

  const contentLength = Number(request.headers?.['content-length'] ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    sendJson(response, 413, { ok: false, error: 'Request body is too large.', issues: ['The analysis request must be 5 MiB or smaller.'] })
    return
  }

  const parsedBody = parseBody(request.body)
  if (!parsedBody || typeof parsedBody !== 'object') {
    sendJson(response, 400, { ok: false, error: 'Invalid JSON request.', issues: ['Send an object with transactions and asOfMs.'] })
    return
  }
  const body = parsedBody as { readonly transactions?: unknown; readonly asOfMs?: unknown; readonly focalAccountId?: unknown }
  const transactionResult = validateTransactions(body.transactions)
  if (transactionResult.issues.length > 0) {
    sendJson(response, 400, { ok: false, error: 'Invalid transaction payload.', issues: transactionResult.issues.slice(0, 20) })
    return
  }

  const rawAsOfMs = body.asOfMs
  if (rawAsOfMs !== null && rawAsOfMs !== undefined && (typeof rawAsOfMs !== 'number' || !Number.isFinite(rawAsOfMs))) {
    sendJson(response, 400, { ok: false, error: 'Invalid cutoff.', issues: ['asOfMs must be a finite number or null for before-first-transfer.'] })
    return
  }
  const asOfMs = typeof rawAsOfMs === 'number' ? rawAsOfMs : Number.NEGATIVE_INFINITY

  if (body.focalAccountId !== undefined && (typeof body.focalAccountId !== 'string' || !ID_PATTERN.test(body.focalAccountId))) {
    sendJson(response, 400, { ok: false, error: 'Invalid focal account.', issues: ['focalAccountId must be a valid account ID string.'] })
    return
  }

  const analysis = analyzeIntelligentSnapshot(
    transactionResult.transactions,
    asOfMs,
    DETECTOR_CONFIG,
    typeof body.focalAccountId === 'string' ? body.focalAccountId : undefined,
  )
  sendJson(response, 200, {
    ok: true,
    engineVersion: 'fintrace-graph-v2',
    processedAt: new Date().toISOString(),
    asOfMs: Number.isFinite(asOfMs) ? asOfMs : null,
    snapshot: analysis.snapshot,
    intelligenceByAccount: analysis.intelligenceByAccount,
  })
}

export default handleAnalyze
