import type { AccountCase, AiAnalysisContext, FlowIntelligence, Transaction } from '../types'

const MAX_RELEVANT_TRANSACTIONS = 120
const MAX_GRAPH_PATHS = 12

interface BuildAiContextInput {
  readonly focalAccountId: string
  readonly asOfMs: number
  readonly selectedCase: AccountCase | undefined
  readonly intelligence: FlowIntelligence | undefined
  readonly visibleTransactions: readonly Transaction[]
  readonly sessionNote: string
}

function evidenceIdsFor(selectedCase: AccountCase | undefined, intelligence: FlowIntelligence | undefined): Set<string> {
  const ids = new Set(selectedCase?.evidenceTransactionIds ?? [])
  intelligence?.signals.forEach((signal) => signal.evidenceTransactionIds.forEach((id) => ids.add(id)))
  intelligence?.paths.forEach((path) => path.transactionIds.forEach((id) => ids.add(id)))
  return ids
}

export function buildAiAnalysisContext({
  focalAccountId,
  asOfMs,
  selectedCase,
  intelligence,
  visibleTransactions,
  sessionNote,
}: BuildAiContextInput): AiAnalysisContext {
  const evidenceIds = evidenceIdsFor(selectedCase, intelligence)
  const relevantTransactions = [...visibleTransactions]
    .filter((transaction) => evidenceIds.has(transaction.id) || transaction.fromAccount === focalAccountId || transaction.toAccount === focalAccountId)
    .sort((left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id))
    .slice(0, MAX_RELEVANT_TRANSACTIONS)

  return {
    focalAccountId,
    cutoffIso: Number.isFinite(asOfMs) ? new Date(asOfMs).toISOString() : null,
    score: selectedCase?.score ?? null,
    priority: selectedCase?.priority ?? null,
    observedTransactionCount: visibleTransactions.length,
    evidenceTransactionIds: [...evidenceIds],
    signals: selectedCase?.signals ?? [],
    ...(intelligence
      ? {
          graphIntelligence: {
            riskScore: intelligence.riskScore,
            directCounterpartyCount: intelligence.directCounterpartyCount,
            maxPathDepth: intelligence.maxPathDepth,
            observedPathCount: intelligence.observedPathCount,
            cycleCount: intelligence.cycleCount,
            velocityTransactionCount: intelligence.velocityTransactionCount,
            observedFlowPaise: intelligence.observedFlowPaise,
            traceTruncated: intelligence.traceTruncated,
            signals: intelligence.signals,
            paths: intelligence.paths.slice(0, MAX_GRAPH_PATHS),
          },
        }
      : {}),
    relevantTransactions,
    sessionNote: sessionNote.trim().slice(0, 1_000),
  }
}
