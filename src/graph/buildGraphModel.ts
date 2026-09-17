import type { AnalysisSnapshot, GraphModel, GraphNode, GraphNodeKind, Transaction } from '../types'

const DISPLAY_NODE_LIMIT = 24
const DISPLAY_EDGE_LIMIT = 60

function nodeKind(
  id: string,
  focalAccountId: string,
  sourceIds: ReadonlySet<string>,
  branchIds: ReadonlySet<string>,
  recipientIds: ReadonlySet<string>,
): GraphNodeKind {
  if (id === focalAccountId) return 'focal'
  if (sourceIds.has(id)) return 'source'
  if (branchIds.has(id)) return 'branch'
  if (recipientIds.has(id)) return 'recipient'
  return 'other'
}

function positionNodes(nodes: readonly { id: string; kind: GraphNodeKind }[]): GraphNode[] {
  const columns: Record<GraphNodeKind, number> = {
    source: 90,
    focal: 350,
    branch: 610,
    recipient: 870,
    other: 480,
  }
  const counts: Record<GraphNodeKind, number> = {
    source: 0,
    focal: 0,
    branch: 0,
    recipient: 0,
    other: 0,
  }

  return [...nodes]
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
    .map(({ id, kind }) => {
      const index = counts[kind]
      counts[kind] += 1
      return {
        id,
        label: id,
        kind,
        position: { x: columns[kind], y: 78 + index * 66 },
      }
    })
}

export function buildGraphModel(snapshot: AnalysisSnapshot, focalAccountId: string): GraphModel {
  const selectedCase = snapshot.cases.find((item) => item.focalAccountId === focalAccountId)
  const evidenceIds = new Set(selectedCase?.evidenceTransactionIds ?? [])
  const candidateTransactions = snapshot.visibleTransactions.filter((transaction) => {
    if (evidenceIds.has(transaction.id)) return true
    if (transaction.fromAccount === focalAccountId || transaction.toAccount === focalAccountId) return true
    return false
  })
  const allCandidateNodeIds = new Set<string>()
  if (snapshot.visibleAccountIds.includes(focalAccountId)) allCandidateNodeIds.add(focalAccountId)
  candidateTransactions.forEach((transaction) => {
    allCandidateNodeIds.add(transaction.fromAccount)
    allCandidateNodeIds.add(transaction.toAccount)
  })

  const sourceIds = new Set(
    candidateTransactions.filter((transaction) => transaction.toAccount === focalAccountId).map((transaction) => transaction.fromAccount),
  )
  const branchIds = new Set(
    candidateTransactions.filter((transaction) => transaction.fromAccount === focalAccountId).map((transaction) => transaction.toAccount),
  )
  const recipientIds = new Set(
    candidateTransactions
      .filter((transaction) => branchIds.has(transaction.fromAccount))
      .map((transaction) => transaction.toAccount),
  )

  const sortedCandidates = [...candidateTransactions].sort((left, right) => {
    const leftPriority = evidenceIds.has(left.id) ? 0 : 1
    const rightPriority = evidenceIds.has(right.id) ? 0 : 1
    return leftPriority - rightPriority || left.timestampMs - right.timestampMs || left.id.localeCompare(right.id)
  })
  const displayTransactions: Transaction[] = []
  const displayNodeIds = new Set<string>()

  for (const transaction of sortedCandidates) {
    if (displayTransactions.length >= DISPLAY_EDGE_LIMIT) break
    const newNodeCount = [transaction.fromAccount, transaction.toAccount].filter((id) => !displayNodeIds.has(id)).length
    if (displayNodeIds.size + newNodeCount > DISPLAY_NODE_LIMIT) continue
    displayTransactions.push(transaction)
    displayNodeIds.add(transaction.fromAccount)
    displayNodeIds.add(transaction.toAccount)
  }
  if (candidateTransactions.length === 0 && snapshot.visibleAccountIds.includes(focalAccountId)) {
    displayNodeIds.add(focalAccountId)
  }

  const rawNodes = [...displayNodeIds].map((id) => ({
    id,
    kind: nodeKind(id, focalAccountId, sourceIds, branchIds, recipientIds),
  }))
  const nodes = positionNodes(rawNodes)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = displayTransactions
    .filter((transaction) => nodeIds.has(transaction.fromAccount) && nodeIds.has(transaction.toAccount))
    .map((transaction) => ({
      id: transaction.id,
      source: transaction.fromAccount,
      target: transaction.toAccount,
      transactionId: transaction.id,
      amountPaise: transaction.amountPaise,
      timestampMs: transaction.timestampMs,
    }))

  return {
    nodes,
    edges,
    truncated: displayTransactions.length < candidateTransactions.length || displayNodeIds.size < allCandidateNodeIds.size,
    totalCandidateEdges: candidateTransactions.length,
    totalCandidateNodes: allCandidateNodeIds.size,
  }
}
