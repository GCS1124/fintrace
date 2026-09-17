import type { DetectorConfig } from '../types.js'

export const DETECTOR_CONFIG: DetectorConfig = Object.freeze({
  collectionWindowMs: 10 * 60 * 1000,
  minDistinctSenders: 6,
  forwardWindowMs: 5 * 60 * 1000,
  minOutflowPercent: 80,
  reconvergeHopWindowMs: 10 * 60 * 1000,
  points: Object.freeze({
    collection: 30,
    forwarding: 40,
    reconvergence: 30,
  }),
  detectorVersion: 'fintrace-rules-v1',
})

export const DISPLAY_TIMEZONE = 'Asia/Kolkata' as const

export const LIMITS = Object.freeze({
  maxFileBytes: 2 * 1024 * 1024,
  maxTransactions: 2_000,
  maxAmountPaise: 10_000_000_000,
})

export const DETECTOR_LIMITATIONS = Object.freeze([
  'Pattern evidence is not proof of fraud.',
  'Heuristic points are not a calibrated fraud probability.',
  'Unknown balances prevent exact fund attribution or FIFO tracing.',
  'Only the supplied transaction records are visible to this prototype.',
  'No bank integration, enforcement or account action is performed.',
  'Synthetic examples do not establish production accuracy.',
])
