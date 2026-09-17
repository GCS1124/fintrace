import type { AiAnalysisContext, AiAnalysisResult } from '../types'

export type AiAnalysisErrorCode = 'not_configured' | 'invalid_request' | 'provider_error' | 'invalid_output' | 'unknown'

export class AiAnalysisRequestError extends Error {
  readonly code: AiAnalysisErrorCode

  constructor(message: string, code: AiAnalysisErrorCode) {
    super(message)
    this.name = 'AiAnalysisRequestError'
    this.code = code
  }
}

interface AiAnalysisResponse {
  readonly ok: boolean
  readonly analysis?: AiAnalysisResult
  readonly code?: AiAnalysisErrorCode
  readonly error?: string
}

function isResponse(value: unknown): value is AiAnalysisResponse {
  return Boolean(value && typeof value === 'object' && typeof (value as { readonly ok?: unknown }).ok === 'boolean')
}

export async function requestGeminiAnalysis(
  context: AiAnalysisContext,
  question: string,
  signal?: AbortSignal,
): Promise<AiAnalysisResult> {
  const response = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, ...(question.trim() ? { question: question.trim() } : {}) }),
    signal,
  })
  const payload: unknown = await response.json().catch(() => undefined)
  if (!isResponse(payload) || !response.ok || !payload.ok || !payload.analysis) {
    const code = isResponse(payload) && payload.code ? payload.code : 'unknown'
    const message = isResponse(payload) && payload.error ? payload.error : `AI analysis returned HTTP ${response.status}.`
    throw new AiAnalysisRequestError(message, code)
  }
  return payload.analysis
}
