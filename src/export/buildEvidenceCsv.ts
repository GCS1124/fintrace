import type { AnalysisSnapshot, FlowIntelligence } from '../types'
import { formatTimestamp } from '../utils/format'
import { sanitiseFilename } from './buildCaseExport'

function escapeCsv(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildEvidenceCsv(snapshot: AnalysisSnapshot, focalAccountId: string, intelligence?: FlowIntelligence): string {
  const selectedCase = snapshot.cases.find((item) => item.focalAccountId === focalAccountId)
  const evidenceIds = new Set(selectedCase?.evidenceTransactionIds ?? [])
  intelligence?.signals.forEach((signal) => signal.evidenceTransactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  intelligence?.paths.forEach((path) => path.transactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  const rows = snapshot.visibleTransactions.filter((transaction) => evidenceIds.has(transaction.id))
  const header = ['transaction_id', 'timestamp_ist', 'from_account', 'to_account', 'amount_inr', 'currency', 'evidence_for_account']
  const body = rows.map((transaction) => [
    transaction.id,
    formatTimestamp(transaction.timestampMs),
    transaction.fromAccount,
    transaction.toAccount,
    (transaction.amountPaise / 100).toFixed(2),
    transaction.currency,
    focalAccountId,
  ].map(escapeCsv).join(','))
  return [header.join(','), ...body].join('\n') + '\n'
}

export function downloadEvidenceCsv(snapshot: AnalysisSnapshot, focalAccountId: string, intelligence?: FlowIntelligence): void {
  const csv = buildEvidenceCsv(snapshot, focalAccountId, intelligence)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `fintrace-${sanitiseFilename(focalAccountId)}-evidence.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
