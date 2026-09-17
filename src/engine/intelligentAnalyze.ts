import type {
  AccountCase,
  AnalysisSnapshot,
  DetectorConfig,
  FlowIntelligence,
  FlowPath,
  IntelligenceSignal,
  IntelligenceSignalId,
  Transaction,
} from '../types.js'
import { analyzeSnapshot } from './analyze.js'

const TRACE_WINDOW_MS = 30 * 60 * 1000
const VELOCITY_WINDOW_MS = 15 * 60 * 1000
const MAX_TRACE_DEPTH = 5
const MAX_BRANCHES_PER_ACCOUNT = 24
const MAX_RETAINED_PATHS = 120

interface TraceState {
  readonly accountIds: readonly string[]
  readonly transactions: readonly Transaction[]
  readonly startMs: number
}

interface TraceResult {
  readonly paths: readonly FlowPath[]
  readonly truncated: boolean
}

function sortTransactions(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id))
}

function indexOutgoing(transactions: readonly Transaction[]): Map<string, Transaction[]> {
  const index = new Map<string, Transaction[]>()
  sortTransactions(transactions).forEach((transaction) => {
    const accountTransactions = index.get(transaction.fromAccount) ?? []
    accountTransactions.push(transaction)
    index.set(transaction.fromAccount, accountTransactions)
  })
  return index
}

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function makePath(
  focalAccountId: string,
  state: TraceState,
  lastTransaction: Transaction,
  kind: FlowPath['kind'],
): FlowPath {
  const transactions = [...state.transactions, lastTransaction]
  return {
    pathId: `${focalAccountId}:${transactions.map((transaction) => transaction.id).join('>')}`,
    kind,
    accountIds: [...state.accountIds, lastTransaction.toAccount],
    transactionIds: transactions.map((transaction) => transaction.id),
    bottleneckPaise: Math.min(...transactions.map((transaction) => transaction.amountPaise)),
    startMs: transactions[0].timestampMs,
    endMs: lastTransaction.timestampMs,
    depth: transactions.length,
  }
}

function makeTerminalPath(focalAccountId: string, state: TraceState): FlowPath {
  const transactions = [...state.transactions]
  const lastTransaction = transactions[transactions.length - 1]
  return {
    pathId: `${focalAccountId}:${transactions.map((transaction) => transaction.id).join('>')}`,
    kind: 'chain',
    accountIds: [...state.accountIds],
    transactionIds: transactions.map((transaction) => transaction.id),
    bottleneckPaise: Math.min(...transactions.map((transaction) => transaction.amountPaise)),
    startMs: state.startMs,
    endMs: lastTransaction.timestampMs,
    depth: transactions.length,
  }
}

/**
 * Trace only chronological paths. Amounts are carried as a bottleneck value,
 * because transaction records alone do not prove that a specific rupee was
 * passed through every edge.
 */
function traceChronologicalPaths(
  transactions: readonly Transaction[],
  focalAccountId: string,
  anchorMs: number,
  asOfMs: number,
  config: DetectorConfig,
): TraceResult {
  const outgoingByAccount = indexOutgoing(transactions)
  const paths: FlowPath[] = []
  let truncated = false

  const appendPath = (path: FlowPath) => {
    if (paths.length >= MAX_RETAINED_PATHS) {
      truncated = true
      return
    }
    paths.push(path)
  }

  const visit = (state: TraceState, currentAccountId: string, lastTimestampMs: number): void => {
    if (paths.length >= MAX_RETAINED_PATHS) {
      truncated = true
      return
    }

    const upperBound = Math.min(asOfMs, state.startMs + TRACE_WINDOW_MS, lastTimestampMs + config.reconvergeHopWindowMs)
    const candidates = (outgoingByAccount.get(currentAccountId) ?? []).filter(
      (transaction) => transaction.timestampMs > lastTimestampMs && transaction.timestampMs <= upperBound,
    )
    if (candidates.length === 0) {
      if (state.transactions.length >= 2) appendPath(makeTerminalPath(focalAccountId, state))
      return
    }
    if (candidates.length > MAX_BRANCHES_PER_ACCOUNT) truncated = true

    for (const nextTransaction of candidates.slice(0, MAX_BRANCHES_PER_ACCOUNT)) {
      if (nextTransaction.toAccount === focalAccountId) {
        if (state.transactions.length >= 1) appendPath(makePath(focalAccountId, state, nextTransaction, 'cycle'))
        continue
      }
      if (state.accountIds.includes(nextTransaction.toAccount)) continue

      const nextState: TraceState = {
        accountIds: [...state.accountIds, nextTransaction.toAccount],
        transactions: [...state.transactions, nextTransaction],
        startMs: state.startMs,
      }
      if (nextState.transactions.length >= MAX_TRACE_DEPTH) {
        appendPath(makeTerminalPath(focalAccountId, nextState))
      } else {
        visit(nextState, nextTransaction.toAccount, nextTransaction.timestampMs)
      }
    }
  }

  const firstHops = (outgoingByAccount.get(focalAccountId) ?? []).filter(
    (transaction) => transaction.timestampMs > anchorMs && transaction.timestampMs <= Math.min(asOfMs, anchorMs + TRACE_WINDOW_MS),
  )
  if (firstHops.length > MAX_BRANCHES_PER_ACCOUNT) truncated = true
  for (const firstHop of firstHops.slice(0, MAX_BRANCHES_PER_ACCOUNT)) {
    visit(
      {
        accountIds: [focalAccountId, firstHop.toAccount],
        transactions: [firstHop],
        startMs: anchorMs,
      },
      firstHop.toAccount,
      firstHop.timestampMs,
    )
  }

  return { paths, truncated }
}

function makeIntelligenceSignal(
  id: IntelligenceSignalId,
  observed: boolean,
  points: number,
  title: string,
  explanation: string,
  evidenceTransactionIds: readonly string[],
): IntelligenceSignal {
  return {
    id,
    status: observed ? 'observed' : 'not_observed',
    points: observed ? points : 0,
    title,
    explanation,
    evidenceTransactionIds: uniqueIds(evidenceTransactionIds),
  }
}

export function analyzeFlowIntelligence(
  transactions: readonly Transaction[],
  selectedCase: AccountCase,
  asOfMs: number,
  config: DetectorConfig,
): FlowIntelligence {
  const visibleTransactions = transactions.filter((transaction) => transaction.timestampMs <= asOfMs)
  const directTransactions = visibleTransactions.filter(
    (transaction) => transaction.fromAccount === selectedCase.focalAccountId || transaction.toAccount === selectedCase.focalAccountId,
  )
  const directCounterparties = new Set(
    directTransactions
      .flatMap((transaction) => [transaction.fromAccount, transaction.toAccount])
      .filter((accountId) => accountId !== selectedCase.focalAccountId),
  )
  const trace = traceChronologicalPaths(
    visibleTransactions,
    selectedCase.focalAccountId,
    selectedCase.anchorMs,
    asOfMs,
    config,
  )
  const paths = [...trace.paths].sort(
    (left, right) => right.depth - left.depth || right.bottleneckPaise - left.bottleneckPaise || left.pathId.localeCompare(right.pathId),
  )
  const tracedAccounts = new Set(paths.flatMap((path) => path.accountIds).concat(selectedCase.focalAccountId))
  const velocityTransactions = visibleTransactions.filter(
    (transaction) =>
      transaction.timestampMs >= selectedCase.anchorMs - config.collectionWindowMs &&
      transaction.timestampMs <= selectedCase.anchorMs + VELOCITY_WINDOW_MS &&
      (tracedAccounts.has(transaction.fromAccount) || tracedAccounts.has(transaction.toAccount)),
  )
  const firstHopTransactions = visibleTransactions.filter(
    (transaction) =>
      transaction.fromAccount === selectedCase.focalAccountId &&
      transaction.timestampMs > selectedCase.anchorMs &&
      transaction.timestampMs <= selectedCase.anchorMs + TRACE_WINDOW_MS,
  )
  const firstHopRecipients = new Set(firstHopTransactions.map((transaction) => transaction.toAccount))
  const cyclePaths = paths.filter((path) => path.kind === 'cycle')
  const maxPathDepth = paths.reduce((maximum, path) => Math.max(maximum, path.depth), 0)
  const observedFlowPaise = paths.reduce((total, path) => total + path.bottleneckPaise, 0)

  const signals = [
    makeIntelligenceSignal(
      'fan_out',
      firstHopRecipients.size >= 3,
      10,
      'Multi-recipient fan-out',
      firstHopRecipients.size >= 3
        ? `${firstHopRecipients.size} distinct first-hop recipients received transfers after the collection anchor.`
        : 'Fewer than three distinct first-hop recipients were observed after the collection anchor.',
      firstHopTransactions.map((transaction) => transaction.id),
    ),
    makeIntelligenceSignal(
      'layering',
      maxPathDepth >= 3,
      20,
      'Multi-hop layering',
      maxPathDepth >= 3
        ? `A chronological path reaches ${maxPathDepth} hops from the focal account within the trace window.`
        : 'No three-hop chronological path was observed within the trace window.',
      paths.filter((path) => path.depth >= 3).flatMap((path) => path.transactionIds),
    ),
    makeIntelligenceSignal(
      'circular',
      cyclePaths.length > 0,
      25,
      'Circular re-entry',
      cyclePaths.length > 0
        ? `${cyclePaths.length} chronological path${cyclePaths.length === 1 ? '' : 's'} return to the focal account.`
        : 'No chronological path returns to the focal account in the trace window.',
      cyclePaths.flatMap((path) => path.transactionIds),
    ),
    makeIntelligenceSignal(
      'velocity',
      velocityTransactions.length >= 10,
      10,
      'Network velocity',
      velocityTransactions.length >= 10
        ? `${velocityTransactions.length} transfers touching the observed network occurred around the collection anchor.`
        : `${velocityTransactions.length} transfers touched the observed network around the collection anchor.`,
      velocityTransactions.map((transaction) => transaction.id),
    ),
  ]
  const advancedPoints = signals.reduce((total, signal) => total + signal.points, 0)

  return {
    engineVersion: 'fintrace-graph-v2',
    riskScore: Math.min(100, selectedCase.score + advancedPoints),
    directCounterpartyCount: directCounterparties.size,
    maxPathDepth,
    observedPathCount: paths.length,
    cycleCount: cyclePaths.length,
    velocityTransactionCount: velocityTransactions.length,
    observedFlowPaise,
    traceTruncated: trace.truncated,
    paths,
    signals,
  }
}

export function enrichSnapshot(
  snapshot: AnalysisSnapshot,
  config: DetectorConfig,
  focalAccountId?: string,
): Readonly<Record<string, FlowIntelligence>> {
  return Object.fromEntries(
    snapshot.cases
      .filter((selectedCase) => !focalAccountId || selectedCase.focalAccountId === focalAccountId)
      .map((selectedCase) => [
        selectedCase.focalAccountId,
        analyzeFlowIntelligence(snapshot.visibleTransactions, selectedCase, snapshot.asOfMs, config),
      ]),
  )
}

export function analyzeIntelligentSnapshot(
  transactions: readonly Transaction[],
  asOfMs: number,
  config: DetectorConfig,
  focalAccountId?: string,
): { readonly snapshot: AnalysisSnapshot; readonly intelligenceByAccount: Readonly<Record<string, FlowIntelligence>> } {
  const snapshot = analyzeSnapshot(transactions, asOfMs, config)
  return { snapshot, intelligenceByAccount: enrichSnapshot(snapshot, config, focalAccountId) }
}
