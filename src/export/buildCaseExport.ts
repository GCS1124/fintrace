import { DETECTOR_CONFIG, DETECTOR_LIMITATIONS, DISPLAY_TIMEZONE } from '../config/detector'
import type { CaseExport, ExportMetadata, AnalysisSnapshot, FlowIntelligence, Transaction } from '../types'

export function buildCaseExport(
  snapshot: AnalysisSnapshot,
  focalAccountId: string,
  metadata: ExportMetadata,
  note: string,
  intelligence?: FlowIntelligence,
): CaseExport {
  const selectedCase = snapshot.cases.find((item) => item.focalAccountId === focalAccountId)
  if (!selectedCase) {
    throw new Error('There is no collection-led case to export at this cutoff.')
  }

  const evidenceIds = new Set(selectedCase.evidenceTransactionIds)
  intelligence?.signals.forEach((signal) => signal.evidenceTransactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  intelligence?.paths.forEach((path) => path.transactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  const supportingTransactions: Transaction[] = snapshot.visibleTransactions.filter((transaction) => evidenceIds.has(transaction.id))

  return {
    schemaVersion: 'fintrace-case-v1',
    detectorVersion: DETECTOR_CONFIG.detectorVersion,
    generatedAt: new Date().toISOString(),
    source: {
      label: metadata.sourceLabel,
      kind: metadata.sourceKind,
      loadedTransactionCount: metadata.loadedTransactionCount,
      ...(metadata.fileSizeBytes === undefined ? {} : { fileSizeBytes: metadata.fileSizeBytes }),
    },
    selectedCutoff: new Date(snapshot.asOfMs).toISOString(),
    displayTimezone: DISPLAY_TIMEZONE,
    ruleConfiguration: DETECTOR_CONFIG,
    investigation: {
      focalAccountId,
      representativeAnchor: new Date(selectedCase.anchorMs).toISOString(),
      score: selectedCase.score,
      priority: selectedCase.priority,
      signals: selectedCase.signals,
      supportingTransactions,
      ...(intelligence ? { graphIntelligence: intelligence } : {}),
      warnings: selectedCase.warnings,
      sessionNote: {
        accountId: focalAccountId,
        text: note,
      },
    },
    limitations: [...DETECTOR_LIMITATIONS],
  }
}

export function sanitiseFilename(value: string): string {
  const safeValue = value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return safeValue || 'account'
}

export function downloadCaseExport(payload: CaseExport): void {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `fintrace-${sanitiseFilename(payload.investigation.focalAccountId)}-${payload.selectedCutoff.slice(0, 10)}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
