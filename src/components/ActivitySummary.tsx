import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDot, Clock3, GitBranch } from 'lucide-react'
import { formatCompactRupees } from '../engine/money'
import { formatCount, formatTime } from '../utils/format'
import type { AccountCase, FlowIntelligence, Transaction } from '../types'
import styles from './ActivitySummary.module.css'

interface ActivitySummaryProps {
  readonly focalAccountId: string | undefined
  readonly asOfMs: number
  readonly visibleTransactions: readonly Transaction[]
  readonly selectedCase: AccountCase | undefined
  readonly intelligence: FlowIntelligence | undefined
}

interface ActivityBucket {
  readonly label: string
  readonly count: number
  readonly incoming: number
  readonly outgoing: number
}

function buildBuckets(transactions: readonly Transaction[], focalAccountId: string | undefined): ActivityBucket[] {
  const relevant = focalAccountId
    ? transactions.filter((transaction) => transaction.fromAccount === focalAccountId || transaction.toAccount === focalAccountId)
    : []
  if (relevant.length === 0) return []
  const minMs = Math.min(...relevant.map((transaction) => transaction.timestampMs))
  const maxMs = Math.max(...relevant.map((transaction) => transaction.timestampMs))
  const span = Math.max(maxMs - minMs, 1)
  const bucketCount = Math.min(6, Math.max(3, relevant.length))
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: formatTime(minMs + (span * index) / Math.max(bucketCount - 1, 1)).slice(0, 5),
    count: 0,
    incoming: 0,
    outgoing: 0,
  }))

  relevant.forEach((transaction) => {
    const rawIndex = Math.floor(((transaction.timestampMs - minMs) / span) * bucketCount)
    const index = Math.min(Math.max(rawIndex, 0), bucketCount - 1)
    const current = buckets[index]
    current.count += 1
    if (transaction.toAccount === focalAccountId) current.incoming += transaction.amountPaise
    if (transaction.fromAccount === focalAccountId) current.outgoing += transaction.amountPaise
  })
  return buckets
}

export function ActivitySummary({ focalAccountId, asOfMs, visibleTransactions, selectedCase, intelligence }: ActivitySummaryProps) {
  const relevantTransactions = useMemo(
    () => focalAccountId ? visibleTransactions.filter((transaction) => transaction.fromAccount === focalAccountId || transaction.toAccount === focalAccountId) : [],
    [focalAccountId, visibleTransactions],
  )
  const buckets = useMemo(() => buildBuckets(visibleTransactions, focalAccountId), [focalAccountId, visibleTransactions])
  const metrics = useMemo(() => {
    const incoming = relevantTransactions.filter((transaction) => transaction.toAccount === focalAccountId)
    const outgoing = relevantTransactions.filter((transaction) => transaction.fromAccount === focalAccountId)
    const counterparties = new Set(relevantTransactions.map((transaction) => transaction.fromAccount === focalAccountId ? transaction.toAccount : transaction.fromAccount))
    const evidenceIds = new Set(selectedCase?.evidenceTransactionIds ?? [])
    intelligence?.signals.forEach((signal) => signal.evidenceTransactionIds.forEach((id) => evidenceIds.add(id)))
    intelligence?.paths.forEach((path) => path.transactionIds.forEach((id) => evidenceIds.add(id)))
    const incomingPaise = incoming.reduce((total, transaction) => total + transaction.amountPaise, 0)
    const outgoingPaise = outgoing.reduce((total, transaction) => total + transaction.amountPaise, 0)
    return {
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      incomingPaise,
      outgoingPaise,
      counterparties: counterparties.size,
      evidenceRows: evidenceIds.size,
      outflowPercent: incomingPaise > 0 ? Math.round((outgoingPaise / incomingPaise) * 100) : 0,
    }
  }, [focalAccountId, intelligence, relevantTransactions, selectedCase])
  const maxBucketCount = Math.max(...buckets.map((bucket) => bucket.count), 1)

  return (
    <section className={styles.panel} aria-labelledby="activity-summary-heading">
      <div className={styles.heading}>
        <div>
          <div className={styles.kicker}><CircleDot size={12} aria-hidden="true" /> Cutoff activity</div>
          <h2 id="activity-summary-heading">Account activity summary</h2>
        </div>
        <span className={styles.cutoff}><Clock3 size={12} aria-hidden="true" /> {Number.isFinite(asOfMs) ? formatTime(asOfMs) : 'Before first transfer'}</span>
      </div>

      {focalAccountId ? (
        <>
          <div className={styles.metricGrid}>
            <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.incoming}`}><ArrowDownLeft size={14} aria-hidden="true" /></span><span><strong>{formatCompactRupees(metrics.incomingPaise)}</strong><small>{metrics.incomingCount} inbound transfers</small></span></div>
            <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.outgoing}`}><ArrowUpRight size={14} aria-hidden="true" /></span><span><strong>{formatCompactRupees(metrics.outgoingPaise)}</strong><small>{metrics.outgoingCount} outbound transfers</small></span></div>
            <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.links}`}><GitBranch size={14} aria-hidden="true" /></span><span><strong>{formatCount(metrics.counterparties)}</strong><small>unique counterparties</small></span></div>
            <div className={styles.metric}><span className={`${styles.metricIcon} ${styles.evidence}`}><CircleDot size={14} aria-hidden="true" /></span><span><strong>{formatCount(metrics.evidenceRows)}</strong><small>evidence rows · {metrics.outflowPercent}% outflow</small></span></div>
          </div>
          <div className={styles.activityChart} aria-label="Visible activity volume by time bucket">
            <div className={styles.chartHeader}><span>Visible activity rhythm</span><span>{relevantTransactions.length} linked rows</span></div>
            <div className={styles.bars}>
              {buckets.length > 0 ? buckets.map((bucket, index) => <div className={styles.barGroup} key={`${bucket.label}-${index}`}><div className={styles.barTrack}><div className={styles.bar} style={{ height: `${Math.max((bucket.count / maxBucketCount) * 100, bucket.count > 0 ? 12 : 0)}%` }} title={`${bucket.count} transfers around ${bucket.label}`} /></div><span>{bucket.label}</span></div>) : <div className={styles.noActivity}>No visible transfers linked to this account at the selected cutoff.</div>}
            </div>
          </div>
        </>
      ) : (
        <div className={styles.noActivity}>Select an account to see cutoff-scoped activity.</div>
      )}
    </section>
  )
}
