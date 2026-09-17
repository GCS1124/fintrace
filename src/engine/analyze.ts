import { DETECTOR_LIMITATIONS } from '../config/detector.js'
import { formatRupees } from './money.js'
import type {
  AccountCase,
  AnalysisSnapshot,
  DetectorConfig,
  ReconvergenceWitness,
  SignalResult,
  Transaction,
} from '../types.js'

interface WitnessCandidate {
  readonly witness: ReconvergenceWitness
  readonly destinationAccountId: string
  readonly firstOnwardTime: number
  readonly secondOnwardTime: number
}

function sortTransactions(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id))
}

function indexTransactions(
  transactions: readonly Transaction[],
  key: (transaction: Transaction) => string,
): Map<string, Transaction[]> {
  const index = new Map<string, Transaction[]>()
  transactions.forEach((transaction) => {
    const value = index.get(key(transaction)) ?? []
    value.push(transaction)
    index.set(key(transaction), value)
  })
  return index
}

function sumPaise(transactions: readonly Transaction[]): number {
  return transactions.reduce((total, transaction) => total + transaction.amountPaise, 0)
}

function uniqueTransactionIds(transactions: readonly Transaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.id))].sort((left, right) => left.localeCompare(right))
}

function formatPercent(outgoingPaise: number, incomingPaise: number): string {
  if (incomingPaise <= 0) return '0%'
  const scaledHundredths = (BigInt(outgoingPaise) * 10_000n) / BigInt(incomingPaise)
  const whole = scaledHundredths / 100n
  const fraction = String(scaledHundredths % 100n).padStart(2, '0').replace(/0+$/, '')
  return `${whole.toString()}${fraction ? `.${fraction}` : ''}%`
}

function priorityForScore(score: 30 | 70 | 100): AccountCase['priority'] {
  if (score === 100) return 'high'
  if (score === 70) return 'review'
  return 'monitor'
}

function getDownstreamTransactions(
  firstHop: Transaction,
  asOfMs: number,
  outgoingByAccount: ReadonlyMap<string, readonly Transaction[]>,
  config: DetectorConfig,
): Transaction[] {
  const upperBound = Math.min(firstHop.timestampMs + config.reconvergeHopWindowMs, asOfMs)
  return (outgoingByAccount.get(firstHop.toAccount) ?? []).filter(
    (transaction) => transaction.timestampMs > firstHop.timestampMs && transaction.timestampMs <= upperBound,
  )
}

function findReconvergenceWitness(
  focalAccountId: string,
  outwardTransactions: readonly Transaction[],
  asOfMs: number,
  outgoingByAccount: ReadonlyMap<string, readonly Transaction[]>,
  config: DetectorConfig,
): WitnessCandidate | undefined {
  const firstHops = [...outwardTransactions].sort(
    (left, right) =>
      left.toAccount.localeCompare(right.toAccount) || left.timestampMs - right.timestampMs || left.id.localeCompare(right.id),
  )
  const candidates: WitnessCandidate[] = []

  for (let leftIndex = 0; leftIndex < firstHops.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < firstHops.length; rightIndex += 1) {
      const firstHop = firstHops[leftIndex]
      const secondHop = firstHops[rightIndex]
      if (firstHop.toAccount === secondHop.toAccount) continue

      const firstDownstream = getDownstreamTransactions(firstHop, asOfMs, outgoingByAccount, config)
      const secondDownstream = getDownstreamTransactions(secondHop, asOfMs, outgoingByAccount, config)
      const firstByDestination = new Map<string, Transaction[]>()
      const secondByDestination = new Map<string, Transaction[]>()

      firstDownstream.forEach((transaction) => {
        const values = firstByDestination.get(transaction.toAccount) ?? []
        values.push(transaction)
        firstByDestination.set(transaction.toAccount, values)
      })
      secondDownstream.forEach((transaction) => {
        const values = secondByDestination.get(transaction.toAccount) ?? []
        values.push(transaction)
        secondByDestination.set(transaction.toAccount, values)
      })

      for (const destinationAccountId of [...firstByDestination.keys()].sort((left, right) => left.localeCompare(right))) {
        if (
          destinationAccountId === focalAccountId ||
          destinationAccountId === firstHop.toAccount ||
          destinationAccountId === secondHop.toAccount ||
          !secondByDestination.has(destinationAccountId)
        ) {
          continue
        }

        const [firstOnward] = [...(firstByDestination.get(destinationAccountId) ?? [])].sort(
          (left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id),
        )
        const [secondOnward] = [...(secondByDestination.get(destinationAccountId) ?? [])].sort(
          (left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id),
        )
        if (!firstOnward || !secondOnward) continue

        candidates.push({
          witness: {
            destinationAccountId,
            firstHopTransactionId: firstHop.id,
            secondHopTransactionId: secondHop.id,
            firstOnwardTransactionId: firstOnward.id,
            secondOnwardTransactionId: secondOnward.id,
          },
          destinationAccountId,
          firstOnwardTime: firstOnward.timestampMs,
          secondOnwardTime: secondOnward.timestampMs,
        })
      }
    }
  }

  candidates.sort(
    (left, right) =>
      left.destinationAccountId.localeCompare(right.destinationAccountId) ||
      left.firstOnwardTime - right.firstOnwardTime ||
      left.secondOnwardTime - right.secondOnwardTime ||
      left.witness.firstOnwardTransactionId.localeCompare(right.witness.firstOnwardTransactionId) ||
      left.witness.secondOnwardTransactionId.localeCompare(right.witness.secondOnwardTransactionId) ||
      left.witness.firstHopTransactionId.localeCompare(right.witness.firstHopTransactionId) ||
      left.witness.secondHopTransactionId.localeCompare(right.witness.secondHopTransactionId),
  )
  return candidates[0]
}

function makeCollectionSignal(
  anchorMs: number,
  collectionTransactions: readonly Transaction[],
  incomingPaise: number,
  config: DetectorConfig,
): SignalResult {
  const distinctSenders = new Set(collectionTransactions.map((transaction) => transaction.fromAccount)).size
  return {
    id: 'collection',
    status: 'triggered',
    points: config.points.collection,
    title: 'Collection burst',
    explanation: `${distinctSenders} distinct senders paid the focal account with ${formatRupees(incomingPaise)} observed within the 10-minute collection window.`,
    observed: {
      distinctSenders,
      incomingPaise,
      anchorMs,
      windowStartMs: anchorMs - config.collectionWindowMs,
    },
    evidenceTransactionIds: uniqueTransactionIds(collectionTransactions),
  }
}

function makeForwardingSignal(
  anchorMs: number,
  collectionTransactions: readonly Transaction[],
  outwardTransactions: readonly Transaction[],
  incomingPaise: number,
  outgoingPaise: number,
  asOfMs: number,
  config: DetectorConfig,
): SignalResult {
  const triggered = outgoingPaise * 100 >= incomingPaise * config.minOutflowPercent
  const status = triggered ? 'triggered' : asOfMs < anchorMs + config.forwardWindowMs ? 'pending' : 'not_observed'
  const explanation = triggered
    ? `${formatRupees(outgoingPaise)} observed outward after the collection anchor (${formatPercent(outgoingPaise, incomingPaise)} of ${formatRupees(incomingPaise)} incoming).`
    : status === 'pending'
      ? `The five-minute observation window is still open; ${formatRupees(outgoingPaise)} of outward movement is visible so far.`
      : `The observed five-minute outward volume did not reach ${config.minOutflowPercent}% of the collection volume.`

  return {
    id: 'forwarding',
    status,
    points: triggered ? config.points.forwarding : 0,
    title: 'Rapid forwarding',
    explanation,
    observed: {
      incomingPaise,
      outgoingPaise,
      observedOutflowPercent: formatPercent(outgoingPaise, incomingPaise),
      thresholdPercent: config.minOutflowPercent,
      windowEndMs: Math.min(anchorMs + config.forwardWindowMs, asOfMs),
    },
    evidenceTransactionIds: uniqueTransactionIds([...collectionTransactions, ...outwardTransactions]),
  }
}

function makeReconvergenceSignal(
  anchorMs: number,
  outwardTransactions: readonly Transaction[],
  downstreamTransactions: readonly Transaction[],
  witness: WitnessCandidate | undefined,
  forwardingTriggered: boolean,
  asOfMs: number,
  config: DetectorConfig,
): SignalResult {
  const status = witness
    ? 'triggered'
    : forwardingTriggered && asOfMs < anchorMs + config.forwardWindowMs + config.reconvergeHopWindowMs
      ? 'pending'
      : 'not_observed'
  const explanation = witness
    ? `Two distinct outward branches reach common recipient ${witness.destinationAccountId} in chronological order.`
    : status === 'pending'
      ? 'Forwarding is present; the conservative 15-minute witness window is still open.'
      : forwardingTriggered
        ? 'No valid two-branch common-recipient witness was observed in the configured window.'
        : 'This check is not applicable until the rapid-forwarding threshold is met.'

  return {
    id: 'reconvergence',
    status,
    points: witness ? config.points.reconvergence : 0,
    title: 'Split and reconverge',
    explanation,
    observed: {
      commonRecipient: witness?.destinationAccountId ?? 'none observed',
      branchCount: witness ? 2 : new Set(outwardTransactions.map((transaction) => transaction.toAccount)).size,
      witnessDeadlineMs: anchorMs + config.forwardWindowMs + config.reconvergeHopWindowMs,
    },
    evidenceTransactionIds: witness
      ? uniqueTransactionIds([
          ...outwardTransactions.filter(
            (transaction) =>
              transaction.id === witness.witness.firstHopTransactionId || transaction.id === witness.witness.secondHopTransactionId,
          ),
          ...downstreamTransactions.filter(
            (transaction) =>
              transaction.id === witness.witness.firstOnwardTransactionId || transaction.id === witness.witness.secondOnwardTransactionId,
          ),
        ])
      : uniqueTransactionIds(downstreamTransactions),
  }
}

function makeCase(
  focalAccountId: string,
  anchorMs: number,
  collectionTransactions: readonly Transaction[],
  asOfMs: number,
  outgoingByAccount: ReadonlyMap<string, readonly Transaction[]>,
  config: DetectorConfig,
): AccountCase {
  const incomingPaise = sumPaise(collectionTransactions)
  const outwardTransactions = (outgoingByAccount.get(focalAccountId) ?? []).filter(
    (transaction) =>
      transaction.timestampMs > anchorMs &&
      transaction.timestampMs <= Math.min(anchorMs + config.forwardWindowMs, asOfMs),
  )
  const outgoingPaise = sumPaise(outwardTransactions)
  const collectionSignal = makeCollectionSignal(anchorMs, collectionTransactions, incomingPaise, config)
  const forwardingSignal = makeForwardingSignal(
    anchorMs,
    collectionTransactions,
    outwardTransactions,
    incomingPaise,
    outgoingPaise,
    asOfMs,
    config,
  )
  const downstreamTransactions = outwardTransactions.flatMap((transaction) =>
    getDownstreamTransactions(transaction, asOfMs, outgoingByAccount, config),
  )
  const witness = forwardingSignal.status === 'triggered'
    ? findReconvergenceWitness(focalAccountId, outwardTransactions, asOfMs, outgoingByAccount, config)
    : undefined
  const reconvergenceSignal = makeReconvergenceSignal(
    anchorMs,
    outwardTransactions,
    downstreamTransactions,
    witness,
    forwardingSignal.status === 'triggered',
    asOfMs,
    config,
  )
  const signals = [collectionSignal, forwardingSignal, reconvergenceSignal] as const
  const score = (collectionSignal.points + forwardingSignal.points + reconvergenceSignal.points) as 30 | 70 | 100
  const evidenceTransactionIds = uniqueTransactionIds([
    ...collectionTransactions,
    ...outwardTransactions,
    ...downstreamTransactions,
  ])
  const warnings = [...DETECTOR_LIMITATIONS]
  if (outgoingPaise > incomingPaise) {
    warnings.push('Observed outward volume exceeds the collection volume; the app cannot attribute which funds moved.')
  }

  return {
    caseId: `${focalAccountId}-${anchorMs}`,
    focalAccountId,
    anchorMs,
    score,
    priority: priorityForScore(score),
    distinctSenders: new Set(collectionTransactions.map((transaction) => transaction.fromAccount)).size,
    incomingPaise,
    outgoingPaise,
    signals,
    evidenceTransactionIds,
    warnings,
    ...(witness ? { reconvergenceWitness: witness.witness } : {}),
  }
}

export function analyzeSnapshot(
  transactions: readonly Transaction[],
  asOfMs: number,
  config: DetectorConfig,
): AnalysisSnapshot {
  const visibleTransactions = sortTransactions(transactions.filter((transaction) => transaction.timestampMs <= asOfMs))
  const incomingByAccount = indexTransactions(visibleTransactions, (transaction) => transaction.toAccount)
  const outgoingByAccount = indexTransactions(visibleTransactions, (transaction) => transaction.fromAccount)
  const visibleAccountIds = [
    ...new Set(visibleTransactions.flatMap((transaction) => [transaction.fromAccount, transaction.toAccount])),
  ].sort((left, right) => left.localeCompare(right))
  const cases: AccountCase[] = []

  for (const [focalAccountId, incomingTransactions] of incomingByAccount.entries()) {
    const anchorTimes = [...new Set(incomingTransactions.map((transaction) => transaction.timestampMs))].sort(
      (left, right) => left - right,
    )
    for (const anchorMs of anchorTimes) {
      const collectionTransactions = incomingTransactions.filter(
        (transaction) => transaction.timestampMs >= anchorMs - config.collectionWindowMs && transaction.timestampMs <= anchorMs,
      )
      if (new Set(collectionTransactions.map((transaction) => transaction.fromAccount)).size < config.minDistinctSenders) continue
      cases.push(
        makeCase(
          focalAccountId,
          anchorMs,
          collectionTransactions,
          asOfMs,
          outgoingByAccount,
          config,
        ),
      )
    }
  }

  const representativeCases = new Map<string, AccountCase>()
  cases.forEach((candidate) => {
    const current = representativeCases.get(candidate.focalAccountId)
    if (
      !current ||
      candidate.score > current.score ||
      (candidate.score === current.score && candidate.anchorMs > current.anchorMs) ||
      (candidate.score === current.score && candidate.anchorMs === current.anchorMs && candidate.caseId < current.caseId)
    ) {
      representativeCases.set(candidate.focalAccountId, candidate)
    }
  })

  const orderedCases = [...representativeCases.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.anchorMs - left.anchorMs ||
      left.focalAccountId.localeCompare(right.focalAccountId),
  )

  return {
    asOfMs,
    visibleTransactions,
    visibleAccountIds,
    cases: orderedCases,
  }
}
