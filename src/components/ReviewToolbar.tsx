import { Bookmark, BookmarkCheck, BrainCircuit, Clipboard, FileDown, Keyboard, ShieldCheck } from 'lucide-react'
import type { AccountCase, ReviewStatus } from '../types'
import styles from './ReviewToolbar.module.css'

interface ReviewToolbarProps {
  readonly focalAccountId: string | undefined
  readonly currentCase: AccountCase | undefined
  readonly reviewStatus: ReviewStatus
  readonly watchlisted: boolean
  readonly onStatusChange: (status: ReviewStatus) => void
  readonly onToggleWatchlist: () => void
  readonly onCopyBrief: () => void
  readonly onExportCsv: () => void
  readonly onOpenShortcuts: () => void
  readonly onFocusAi: () => void
}

function statusLabel(status: ReviewStatus): string {
  if (status === 'in_review') return 'In review'
  if (status === 'ready_to_escalate') return 'Ready to escalate'
  if (status === 'closed') return 'Closed'
  return 'Open'
}

export function ReviewToolbar({
  focalAccountId,
  currentCase,
  reviewStatus,
  watchlisted,
  onStatusChange,
  onToggleWatchlist,
  onCopyBrief,
  onExportCsv,
  onOpenShortcuts,
  onFocusAi,
}: ReviewToolbarProps) {
  const disabled = !focalAccountId

  return (
    <section className={styles.toolbar} aria-label="Case workflow controls">
      <div className={styles.caseSummary}>
        <div className={styles.workflowIcon}><ShieldCheck size={16} aria-hidden="true" /></div>
        <div>
          <div className={styles.kicker}>Case workflow</div>
          <strong>{focalAccountId ?? 'No account selected'}</strong>
          <span>{currentCase ? `${currentCase.score}/100 · ${statusLabel(reviewStatus)}` : 'Select a qualifying case to activate controls'}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <label className={styles.statusSelect}>
          <span>Status</span>
          <select value={reviewStatus} onChange={(event) => onStatusChange(event.target.value as ReviewStatus)} disabled={disabled} aria-label="Case workflow status">
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="ready_to_escalate">Ready to escalate</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button type="button" className={`${styles.actionButton} ${watchlisted ? styles.actionButtonActive : ''}`} onClick={onToggleWatchlist} disabled={disabled} title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}>
          {watchlisted ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
          <span>{watchlisted ? 'Watched' : 'Watch'}</span>
        </button>
        <button type="button" className={styles.actionButton} onClick={onFocusAi} disabled={disabled} title="Open Gemini case analysis">
          <BrainCircuit size={14} aria-hidden="true" /><span>Ask Gemini</span>
        </button>
        <button type="button" className={styles.actionButton} onClick={onCopyBrief} disabled={disabled} title="Copy a reviewer brief">
          <Clipboard size={14} aria-hidden="true" /><span>Copy brief</span>
        </button>
        <button type="button" className={styles.actionButton} onClick={onExportCsv} disabled={disabled} title="Export visible evidence rows as CSV">
          <FileDown size={14} aria-hidden="true" /><span>Evidence CSV</span>
        </button>
        <button type="button" className={styles.shortcutButton} onClick={onOpenShortcuts} title="Show keyboard shortcuts">
          <Keyboard size={14} aria-hidden="true" /><span>Shortcuts</span>
        </button>
      </div>
    </section>
  )
}
