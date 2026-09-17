import { EXAMPLE_DATASETS } from '../data/examples'
import type { Transaction } from '../types'

export const canonicalTransactions = EXAMPLE_DATASETS[0].transactions
export const merchantTransactions = EXAMPLE_DATASETS[1].transactions
export const ambiguousTransactions = EXAMPLE_DATASETS[2].transactions

export function makeTransaction(
  id: string,
  timestamp: string,
  fromAccount: string,
  toAccount: string,
  amountPaise: number,
): Transaction {
  return { id, timestampMs: Date.parse(timestamp), fromAccount, toAccount, amountPaise, currency: 'INR' }
}

export function makeCollectionBase(
  focalAccountId = 'FOCAL',
  firstIncoming = '2026-09-18T09:00:00+05:30',
  senderPrefix = 'SRC',
  amountPaise = 10_000,
): Transaction[] {
  const start = Date.parse(firstIncoming)
  return Array.from({ length: 6 }, (_, index) => ({
    id: `${senderPrefix}-IN-${index + 1}`,
    timestampMs: start + index * 20_000,
    fromAccount: `${senderPrefix}-${index + 1}`,
    toAccount: focalAccountId,
    amountPaise,
    currency: 'INR' as const,
  }))
}

export function latestCanonicalTimestamp(): number {
  return Math.max(...canonicalTransactions.map((transaction) => transaction.timestampMs))
}
