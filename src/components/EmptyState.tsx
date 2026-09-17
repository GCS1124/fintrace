import { ArrowRight, Download, FileJson, FileUp, GitBranch, History, Sparkles } from 'lucide-react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  readonly onLoadDemo: () => void
  readonly onImport: () => void
  readonly onDownloadTemplate: () => void
}

export function EmptyState({ onLoadDemo, onImport, onDownloadTemplate }: EmptyStateProps) {
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="empty-title">
        <div className={styles.heroCopy}>
          <div className={styles.icon} aria-hidden="true">
            <Sparkles size={22} />
          </div>
          <p className={styles.eyebrow}>LOCAL-FIRST ANALYSIS</p>
          <h1 id="empty-title">Follow the money. Explain the risk.</h1>
          <p className={styles.description}>
            Trace connected payments and review the evidence behind suspicious patterns, one observation time at a time.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryAction} onClick={onLoadDemo}>
              Load demo
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className={styles.secondaryAction} onClick={onImport}>
              <FileUp size={16} aria-hidden="true" />
              Import CSV
            </button>
          </div>
          <button type="button" className={styles.templateLink} onClick={onDownloadTemplate}>
            <Download size={14} aria-hidden="true" />
            Download the CSV template
          </button>
        </div>
        <div className={styles.workflow} aria-label="FINTRACE workflow">
          <div className={styles.workflowHeader}>
            <span>Review workflow</span>
            <small>Three focused steps</small>
          </div>
          <div className={styles.workflowItem}>
            <span className={styles.workflowIcon}><History size={15} aria-hidden="true" /></span>
            <span><strong>Replay the timeline</strong><small>See when a pattern first becomes observable.</small></span>
          </div>
          <div className={styles.workflowItem}>
            <span className={styles.workflowIcon}><GitBranch size={15} aria-hidden="true" /></span>
            <span><strong>Trace the network</strong><small>Inspect accounts, paths, cycles, and counterparties.</small></span>
          </div>
          <div className={styles.workflowItem}>
            <span className={styles.workflowIcon}><FileJson size={15} aria-hidden="true" /></span>
            <span><strong>Package the evidence</strong><small>Save a case or export a review-ready JSON snapshot.</small></span>
          </div>
        </div>
        <div className={styles.notice}>
          <span className={styles.noticeDot} aria-hidden="true" />
          Demonstration tool. Use synthetic or appropriately authorised data.
        </div>
      </section>
    </main>
  )
}
