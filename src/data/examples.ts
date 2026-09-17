import type { DatasetDefinition, Transaction } from '../types'

function tx(
  id: string,
  timestamp: string,
  fromAccount: string,
  toAccount: string,
  amountRupees: string,
): Transaction {
  const [whole, fraction = ''] = amountRupees.split('.')
  const amountPaise = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0'))
  return Object.freeze({
    id,
    timestampMs: Date.parse(timestamp),
    fromAccount,
    toAccount,
    amountPaise,
    currency: 'INR' as const,
  })
}

const splitAndReconvergeTransactions = [
  tx('T001', '2026-09-18T10:00:00+05:30', 'A001', 'A101', '5000.00'),
  tx('T002', '2026-09-18T10:00:20+05:30', 'A002', 'A101', '5000.00'),
  tx('T003', '2026-09-18T10:00:40+05:30', 'A003', 'A101', '5000.00'),
  tx('T004', '2026-09-18T10:01:00+05:30', 'A004', 'A101', '5000.00'),
  tx('T005', '2026-09-18T10:01:20+05:30', 'A005', 'A101', '5000.00'),
  tx('T006', '2026-09-18T10:01:40+05:30', 'A006', 'A101', '5000.00'),
  tx('T007', '2026-09-18T10:01:50+05:30', 'A007', 'A101', '5000.00'),
  tx('T008', '2026-09-18T10:02:00+05:30', 'A008', 'A101', '5000.00'),
  tx('T009', '2026-09-18T10:04:00+05:30', 'A101', 'A201', '19000.00'),
  tx('T010', '2026-09-18T10:04:30+05:30', 'A101', 'A202', '19000.00'),
  tx('T011', '2026-09-18T10:06:00+05:30', 'A201', 'A301', '18500.00'),
  tx('T012', '2026-09-18T10:06:30+05:30', 'A202', 'A301', '18500.00'),
] as const

const merchantTransactions = [
  tx('M001', '2026-09-18T12:00:00+05:30', 'M001', 'A501', '2000.00'),
  tx('M002', '2026-09-18T12:00:20+05:30', 'M002', 'A501', '2000.00'),
  tx('M003', '2026-09-18T12:00:40+05:30', 'M003', 'A501', '2000.00'),
  tx('M004', '2026-09-18T12:01:00+05:30', 'M004', 'A501', '2000.00'),
  tx('M005', '2026-09-18T12:01:20+05:30', 'M005', 'A501', '2000.00'),
  tx('M006', '2026-09-18T12:01:40+05:30', 'M006', 'A501', '2000.00'),
  tx('M007', '2026-09-18T12:01:50+05:30', 'M007', 'A501', '2000.00'),
  tx('M008', '2026-09-18T12:02:00+05:30', 'M008', 'A501', '2000.00'),
  tx('M009', '2026-09-18T12:30:00+05:30', 'A501', 'SUPPLIER-01', '15000.00'),
] as const

const ambiguousSettlementTransactions = [
  tx('L101', '2026-09-18T14:00:00+05:30', 'L001', 'L101', '5000.00'),
  tx('L102', '2026-09-18T14:00:23+05:30', 'L002', 'L101', '5000.00'),
  tx('L103', '2026-09-18T14:00:46+05:30', 'L003', 'L101', '5000.00'),
  tx('L104', '2026-09-18T14:01:09+05:30', 'L004', 'L101', '5000.00'),
  tx('L105', '2026-09-18T14:01:32+05:30', 'L005', 'L101', '5000.00'),
  tx('L106', '2026-09-18T14:01:55+05:30', 'L006', 'L101', '5000.00'),
  tx('L107', '2026-09-18T14:02:18+05:30', 'L007', 'L101', '5000.00'),
  tx('L108', '2026-09-18T14:02:41+05:30', 'L008', 'L101', '5000.00'),
  tx('L109', '2026-09-18T14:04:41+05:30', 'L101', 'L201', '19000.00'),
  tx('L110', '2026-09-18T14:05:11+05:30', 'L101', 'L202', '19000.00'),
  tx('L111', '2026-09-18T14:07:01+05:30', 'L201', 'L301', '18500.00'),
  tx('L112', '2026-09-18T14:07:31+05:30', 'L202', 'L301', '18500.00'),
] as const

export const EXAMPLE_DATASETS: readonly DatasetDefinition[] = Object.freeze([
  Object.freeze({
    id: 'split-reconverge',
    label: 'Split and reconverge',
    description: 'A collection burst followed by rapid split payments and a shared destination.',
    transactions: splitAndReconvergeTransactions,
    sourceKind: 'synthetic' as const,
  }),
  Object.freeze({
    id: 'merchant-collection',
    label: 'Merchant collection',
    description: 'Many customer payments with a supplier settlement outside the rapid window.',
    transactions: merchantTransactions,
    sourceKind: 'synthetic' as const,
  }),
  Object.freeze({
    id: 'ambiguous-settlement',
    label: 'Ambiguous settlement',
    description: 'A legitimate-labelled pooled settlement that matches the same observed pattern.',
    transactions: ambiguousSettlementTransactions,
    sourceKind: 'synthetic' as const,
    scenarioNote: 'Intentional evaluation false positive: observed pattern alone cannot establish wrongdoing.',
  }),
])

export const CSV_TEMPLATE = [
  'transaction_id,timestamp,from_account,to_account,amount,currency',
  'T001,2026-09-18T10:00:00+05:30,A001,A101,5000.00,INR',
].join('\n')

export function getExampleDataset(id: string): DatasetDefinition | undefined {
  return EXAMPLE_DATASETS.find((example) => example.id === id)
}
