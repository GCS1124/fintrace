import type { AnalysisSnapshot, FlowIntelligence, Transaction } from '../types'

export interface ServerAnalysisResult {
  readonly engineVersion: 'fintrace-graph-v2'
  readonly asOfMs: number | null
  readonly snapshot: AnalysisSnapshot
  readonly intelligenceByAccount: Readonly<Record<string, FlowIntelligence>>
}

function isServerAnalysisResult(value: unknown): value is ServerAnalysisResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<ServerAnalysisResult> & { readonly ok?: unknown }
  return result.ok === true && result.engineVersion === 'fintrace-graph-v2' && typeof result.snapshot === 'object' && typeof result.intelligenceByAccount === 'object'
}

export async function requestServerAnalysis(
  transactions: readonly Transaction[],
  asOfMs: number,
  focalAccountId: string | undefined,
  signal?: AbortSignal,
): Promise<ServerAnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactions,
      asOfMs: Number.isFinite(asOfMs) ? asOfMs : null,
      ...(focalAccountId ? { focalAccountId } : {}),
    }),
    signal,
  })
  if (!response.ok) throw new Error(`Analysis service returned HTTP ${response.status}.`)
  const payload: unknown = await response.json()
  if (!isServerAnalysisResult(payload)) throw new Error('Analysis service returned an invalid response.')
  return payload
}
