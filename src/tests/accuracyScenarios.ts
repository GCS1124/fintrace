import type { IntelligenceSignalId, SignalStatus, Transaction } from '../types'

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const BASE_START_MS = Date.parse('2026-09-18T09:00:00+05:30')

export interface AccuracyExpectation {
  readonly score: 0 | 30 | 70 | 100
  readonly forwardingStatus?: SignalStatus
  readonly reconvergenceStatus?: SignalStatus
  readonly observedSignals?: readonly IntelligenceSignalId[]
  readonly notObservedSignals?: readonly IntelligenceSignalId[]
  readonly expectedPathDepth?: number
  readonly expectedPathCount?: number
  readonly expectedCycleCount?: number
  readonly expectedVelocityTransactionCount?: number
  readonly witnessDestination?: string
  readonly notVisibleTransactionIds?: readonly string[]
  readonly excludedTransactionIds?: readonly string[]
  readonly warningSubstring?: string
}

export interface AccuracyScenario {
  readonly id: string
  readonly label: string
  readonly focalAccountId: string
  readonly transactions: readonly Transaction[]
  readonly asOfMs: number
  readonly expected: AccuracyExpectation
}

interface CollectionOptions {
  readonly senderCount?: number
  readonly amountPaise?: number
  readonly intervalMs?: number
}

interface EdgeSpec {
  readonly id: string
  readonly offsetMs: number
  readonly fromAccount: string
  readonly toAccount: string
  readonly amountPaise: number
}

interface ScenarioOptions {
  readonly collection?: CollectionOptions | false
  readonly edges?: readonly EdgeSpec[]
  readonly cutoffOffsetMs: number
  readonly expected: AccuracyExpectation
}

function makeTransaction(
  id: string,
  timestampMs: number,
  fromAccount: string,
  toAccount: string,
  amountPaise: number,
): Transaction {
  return { id, timestampMs, fromAccount, toAccount, amountPaise, currency: 'INR' }
}

function makeCollection(
  focalAccountId: string,
  prefix: string,
  startMs: number,
  options: CollectionOptions = {},
): Transaction[] {
  const senderCount = options.senderCount ?? 6
  const amountPaise = options.amountPaise ?? 10_000
  const intervalMs = options.intervalMs ?? 20_000
  return Array.from({ length: senderCount }, (_, index) => makeTransaction(
    `${prefix}-IN-${index + 1}`,
    startMs + index * intervalMs,
    `${prefix}-SRC-${index + 1}`,
    focalAccountId,
    amountPaise,
  ))
}

function buildScenario(
  index: number,
  label: string,
  focalAccountId: string,
  options: ScenarioOptions,
): AccuracyScenario {
  const prefix = `S${String(index).padStart(2, '0')}`
  const startMs = BASE_START_MS + (index - 1) * DAY_MS
  const collectionTransactions = options.collection === false
    ? []
    : makeCollection(focalAccountId, prefix, startMs, options.collection)
  const edgeTransactions = (options.edges ?? []).map((edge) => makeTransaction(
    `${prefix}-${edge.id}`,
    startMs + edge.offsetMs,
    edge.fromAccount,
    edge.toAccount,
    edge.amountPaise,
  ))

  return {
    id: prefix.toLowerCase(),
    label,
    focalAccountId,
    transactions: [...collectionTransactions, ...edgeTransactions],
    asOfMs: startMs + options.cutoffOffsetMs,
    expected: options.expected,
  }
}

const collectionOnly: AccuracyExpectation = {
  score: 30,
  forwardingStatus: 'not_observed',
  reconvergenceStatus: 'not_observed',
  expectedPathCount: 0,
  expectedPathDepth: 0,
  expectedCycleCount: 0,
  notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
}

/**
 * A deterministic, synthetic accuracy matrix for the rules and graph engine.
 * Each scenario uses an isolated account namespace and a separate day so it
 * can also be flattened into one CSV without cross-scenario contamination.
 */
export const ACCURACY_SCENARIOS: readonly AccuracyScenario[] = [
  buildScenario(1, 'Single transfer without a collection burst', 'S01-F', {
    collection: false,
    edges: [{ id: 'TX-1', offsetMs: 0, fromAccount: 'S01-SRC', toAccount: 'S01-F', amountPaise: 10_000 }],
    cutoffOffsetMs: 2 * MINUTE_MS,
    expected: { score: 0 },
  }),
  buildScenario(2, 'Five senders stay below the six-sender threshold', 'S02-F', {
    collection: { senderCount: 5 },
    cutoffOffsetMs: 3 * MINUTE_MS,
    expected: { score: 0 },
  }),
  buildScenario(3, 'Six senders are dispersed beyond the ten-minute window', 'S03-F', {
    collection: { intervalMs: 11 * MINUTE_MS },
    cutoffOffsetMs: 56 * MINUTE_MS,
    expected: { score: 0 },
  }),
  buildScenario(4, 'Minimum collection burst with no outward movement', 'S04-F', {
    cutoffOffsetMs: 7 * MINUTE_MS,
    expected: collectionOnly,
  }),
  buildScenario(5, 'Eight-sender collection remains a monitor signal', 'S05-F', {
    collection: { senderCount: 8 },
    cutoffOffsetMs: 9 * MINUTE_MS,
    expected: collectionOnly,
  }),
  buildScenario(6, '79.99 percent outward movement stays below forwarding threshold', 'S06-F', {
    edges: [{ id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S06-F', toAccount: 'S06-BENE', amountPaise: 47_994 }],
    cutoffOffsetMs: 7 * MINUTE_MS,
    expected: { ...collectionOnly },
  }),
  buildScenario(7, 'Exact 80 percent outward movement triggers forwarding', 'S07-F', {
    edges: [{ id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S07-F', toAccount: 'S07-BENE', amountPaise: 48_000 }],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(8, 'Outward movement before the collection anchor is ignored', 'S08-F', {
    edges: [{ id: 'OUT-1', offsetMs: -MINUTE_MS, fromAccount: 'S08-F', toAccount: 'S08-BENE', amountPaise: 48_000 }],
    cutoffOffsetMs: 7 * MINUTE_MS,
    expected: { ...collectionOnly },
  }),
  buildScenario(9, 'Outward movement exactly at the five-minute boundary is included', 'S09-F', {
    edges: [{ id: 'OUT-1', offsetMs: 6 * MINUTE_MS + 40_000, fromAccount: 'S09-F', toAccount: 'S09-BENE', amountPaise: 48_000 }],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(10, 'One millisecond after the five-minute boundary is excluded', 'S10-F', {
    edges: [{ id: 'OUT-1', offsetMs: 6 * MINUTE_MS + 40_001, fromAccount: 'S10-F', toAccount: 'S10-BENE', amountPaise: 48_000 }],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: { ...collectionOnly },
  }),
  buildScenario(11, 'Two rapid branches without a common recipient score review', 'S11-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S11-F', toAccount: 'S11-B1', amountPaise: 24_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 30_000, fromAccount: 'S11-F', toAccount: 'S11-B2', amountPaise: 24_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(12, 'Two branches reconverge at the exact ten-minute hop boundary', 'S12-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S12-F', toAccount: 'S12-B1', amountPaise: 24_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 30_000, fromAccount: 'S12-F', toAccount: 'S12-B2', amountPaise: 24_000 },
      { id: 'ON-1', offsetMs: 14 * MINUTE_MS, fromAccount: 'S12-B1', toAccount: 'S12-COMMON', amountPaise: 1_000 },
      { id: 'ON-2', offsetMs: 14 * MINUTE_MS + 30_000, fromAccount: 'S12-B2', toAccount: 'S12-COMMON', amountPaise: 1_000 },
    ],
    cutoffOffsetMs: 15 * MINUTE_MS,
    expected: {
      score: 100,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'triggered',
      expectedPathCount: 2,
      expectedPathDepth: 2,
      expectedCycleCount: 0,
      expectedVelocityTransactionCount: 10,
      notObservedSignals: ['fan_out', 'layering', 'circular'],
      observedSignals: ['velocity'],
      witnessDestination: 'S12-COMMON',
    },
  }),
  buildScenario(13, 'A three-hop chronological chain exposes layering', 'S13-F', {
    edges: [
      { id: 'EDGE-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S13-F', toAccount: 'S13-B1', amountPaise: 48_000 },
      { id: 'EDGE-2', offsetMs: 5 * MINUTE_MS, fromAccount: 'S13-B1', toAccount: 'S13-B2', amountPaise: 47_000 },
      { id: 'EDGE-3', offsetMs: 6 * MINUTE_MS, fromAccount: 'S13-B2', toAccount: 'S13-B3', amountPaise: 46_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 1,
      expectedPathDepth: 3,
      expectedCycleCount: 0,
      observedSignals: ['layering'],
      notObservedSignals: ['fan_out', 'circular', 'velocity'],
    },
  }),
  buildScenario(14, 'Three distinct first-hop recipients trigger fan-out', 'S14-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S14-F', toAccount: 'S14-R1', amountPaise: 16_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 20_000, fromAccount: 'S14-F', toAccount: 'S14-R2', amountPaise: 16_000 },
      { id: 'OUT-3', offsetMs: 4 * MINUTE_MS + 40_000, fromAccount: 'S14-F', toAccount: 'S14-R3', amountPaise: 16_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      observedSignals: ['fan_out'],
      notObservedSignals: ['layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(15, 'Four first-hop recipients reach the network velocity threshold', 'S15-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S15-F', toAccount: 'S15-R1', amountPaise: 12_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 20_000, fromAccount: 'S15-F', toAccount: 'S15-R2', amountPaise: 12_000 },
      { id: 'OUT-3', offsetMs: 4 * MINUTE_MS + 40_000, fromAccount: 'S15-F', toAccount: 'S15-R3', amountPaise: 12_000 },
      { id: 'OUT-4', offsetMs: 5 * MINUTE_MS, fromAccount: 'S15-F', toAccount: 'S15-R4', amountPaise: 12_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      expectedVelocityTransactionCount: 10,
      observedSignals: ['fan_out', 'velocity'],
      notObservedSignals: ['layering', 'circular'],
    },
  }),
  buildScenario(16, 'Chronological circular re-entry is bounded and explainable', 'S16-F', {
    edges: [
      { id: 'EDGE-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S16-F', toAccount: 'S16-B1', amountPaise: 48_000 },
      { id: 'EDGE-2', offsetMs: 5 * MINUTE_MS, fromAccount: 'S16-B1', toAccount: 'S16-B2', amountPaise: 47_000 },
      { id: 'EDGE-3', offsetMs: 6 * MINUTE_MS, fromAccount: 'S16-B2', toAccount: 'S16-F', amountPaise: 46_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 1,
      expectedPathDepth: 3,
      expectedCycleCount: 1,
      observedSignals: ['layering', 'circular'],
      notObservedSignals: ['fan_out', 'velocity'],
    },
  }),
  buildScenario(17, 'A direct two-edge return detects a cycle without layering', 'S17-F', {
    edges: [
      { id: 'EDGE-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S17-F', toAccount: 'S17-B1', amountPaise: 48_000 },
      { id: 'EDGE-2', offsetMs: 5 * MINUTE_MS, fromAccount: 'S17-B1', toAccount: 'S17-F', amountPaise: 47_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 1,
      expectedPathDepth: 2,
      expectedCycleCount: 1,
      observedSignals: ['circular'],
      notObservedSignals: ['fan_out', 'layering', 'velocity'],
    },
  }),
  buildScenario(18, 'A hop after ten minutes is not traced as layering', 'S18-F', {
    edges: [
      { id: 'EDGE-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S18-F', toAccount: 'S18-B1', amountPaise: 48_000 },
      { id: 'EDGE-2', offsetMs: 15 * MINUTE_MS + 1, fromAccount: 'S18-B1', toAccount: 'S18-B2', amountPaise: 47_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(19, 'A future onward transfer cannot create a premature witness', 'S19-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S19-F', toAccount: 'S19-B1', amountPaise: 24_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 30_000, fromAccount: 'S19-F', toAccount: 'S19-B2', amountPaise: 24_000 },
      { id: 'ON-1', offsetMs: 14 * MINUTE_MS, fromAccount: 'S19-B1', toAccount: 'S19-COMMON', amountPaise: 1_000 },
      { id: 'ON-2', offsetMs: 14 * MINUTE_MS + 30_000, fromAccount: 'S19-B2', toAccount: 'S19-COMMON', amountPaise: 1_000 },
    ],
    cutoffOffsetMs: 14 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'pending',
      expectedPathCount: 1,
      expectedPathDepth: 2,
      expectedCycleCount: 0,
      notVisibleTransactionIds: ['S19-ON-2'],
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(20, 'Two onward payments from one intermediary are not two branches', 'S20-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S20-F', toAccount: 'S20-SAME', amountPaise: 48_000 },
      { id: 'ON-1', offsetMs: 5 * MINUTE_MS, fromAccount: 'S20-SAME', toAccount: 'S20-COMMON', amountPaise: 1_000 },
      { id: 'ON-2', offsetMs: 5 * MINUTE_MS + 30_000, fromAccount: 'S20-SAME', toAccount: 'S20-COMMON', amountPaise: 1_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 2,
      expectedPathDepth: 2,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(21, 'Multiple common recipients choose the deterministic witness', 'S21-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S21-F', toAccount: 'S21-B1', amountPaise: 24_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 30_000, fromAccount: 'S21-F', toAccount: 'S21-B2', amountPaise: 24_000 },
      { id: 'ON-1A', offsetMs: 5 * MINUTE_MS, fromAccount: 'S21-B1', toAccount: 'S21-COMMON-A', amountPaise: 1_000 },
      { id: 'ON-1B', offsetMs: 5 * MINUTE_MS + 10_000, fromAccount: 'S21-B1', toAccount: 'S21-COMMON-B', amountPaise: 1_000 },
      { id: 'ON-2A', offsetMs: 5 * MINUTE_MS + 30_000, fromAccount: 'S21-B2', toAccount: 'S21-COMMON-A', amountPaise: 1_000 },
      { id: 'ON-2B', offsetMs: 5 * MINUTE_MS + 40_000, fromAccount: 'S21-B2', toAccount: 'S21-COMMON-B', amountPaise: 1_000 },
    ],
    cutoffOffsetMs: 8 * MINUTE_MS,
    expected: {
      score: 100,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'triggered',
      expectedPathCount: 4,
      expectedPathDepth: 2,
      expectedCycleCount: 0,
      expectedVelocityTransactionCount: 12,
      observedSignals: ['velocity'],
      notObservedSignals: ['fan_out', 'layering', 'circular'],
      witnessDestination: 'S21-COMMON-A',
    },
  }),
  buildScenario(22, 'Outflow above the observed collection is flagged without false attribution', 'S22-F', {
    edges: [{ id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S22-F', toAccount: 'S22-BENE', amountPaise: 90_000 }],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      warningSubstring: 'exceeds the collection volume',
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(23, 'Below-threshold forwarding stays pending while its window is open', 'S23-F', {
    edges: [{ id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S23-F', toAccount: 'S23-BENE', amountPaise: 47_994 }],
    cutoffOffsetMs: 4 * MINUTE_MS + 30_000,
    expected: {
      score: 30,
      forwardingStatus: 'pending',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 0,
      expectedPathDepth: 0,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(24, 'Nine network transfers stay below the velocity signal boundary', 'S24-F', {
    edges: [
      { id: 'OUT-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S24-F', toAccount: 'S24-B1', amountPaise: 24_000 },
      { id: 'OUT-2', offsetMs: 4 * MINUTE_MS + 30_000, fromAccount: 'S24-F', toAccount: 'S24-B2', amountPaise: 24_000 },
      { id: 'ON-1', offsetMs: 5 * MINUTE_MS, fromAccount: 'S24-B1', toAccount: 'S24-COMMON', amountPaise: 1_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 1,
      expectedPathDepth: 2,
      expectedCycleCount: 0,
      notObservedSignals: ['fan_out', 'layering', 'circular', 'velocity'],
    },
  }),
  buildScenario(25, 'Deep layering is capped at five traced hops for bounded execution', 'S25-F', {
    edges: [
      { id: 'EDGE-1', offsetMs: 4 * MINUTE_MS, fromAccount: 'S25-F', toAccount: 'S25-B1', amountPaise: 48_000 },
      { id: 'EDGE-2', offsetMs: 5 * MINUTE_MS, fromAccount: 'S25-B1', toAccount: 'S25-B2', amountPaise: 47_000 },
      { id: 'EDGE-3', offsetMs: 6 * MINUTE_MS, fromAccount: 'S25-B2', toAccount: 'S25-B3', amountPaise: 46_000 },
      { id: 'EDGE-4', offsetMs: 7 * MINUTE_MS, fromAccount: 'S25-B3', toAccount: 'S25-B4', amountPaise: 45_000 },
      { id: 'EDGE-5', offsetMs: 8 * MINUTE_MS, fromAccount: 'S25-B4', toAccount: 'S25-B5', amountPaise: 44_000 },
      { id: 'EDGE-6', offsetMs: 9 * MINUTE_MS, fromAccount: 'S25-B5', toAccount: 'S25-B6', amountPaise: 43_000 },
    ],
    cutoffOffsetMs: 17 * MINUTE_MS,
    expected: {
      score: 70,
      forwardingStatus: 'triggered',
      reconvergenceStatus: 'not_observed',
      expectedPathCount: 1,
      expectedPathDepth: 5,
      expectedCycleCount: 0,
      expectedVelocityTransactionCount: 12,
      observedSignals: ['layering', 'velocity'],
      notObservedSignals: ['fan_out', 'circular'],
      excludedTransactionIds: ['S25-EDGE-6'],
    },
  }),
] as const

export const ACCURACY_SCENARIO_COUNT = ACCURACY_SCENARIOS.length
