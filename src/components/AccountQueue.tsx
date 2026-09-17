import { ArrowDownAZ, Bookmark, BookmarkCheck, Search, SlidersHorizontal, X } from 'lucide-react'
import { formatCompactRupees } from '../engine/money'
import type { QueueSort } from '../hooks/useInvestigation'
import { formatTime, titleCase } from '../utils/format'
import type { AccountCase, Priority, ReviewStatus } from '../types'
import styles from './AccountQueue.module.css'

interface AccountQueueProps {
  readonly cases: readonly AccountCase[]
  readonly totalCaseCount: number
  readonly selectedAccountId: string | undefined
  readonly searchQuery: string
  readonly priorityFilter: 'all' | Priority
  readonly queueSort: QueueSort
  readonly reviewStatusByAccount: Readonly<Record<string, ReviewStatus>>
  readonly watchlistedByAccount: Readonly<Record<string, boolean>>
  readonly selectedOutsideFilter: boolean
  readonly onSearchChange: (value: string) => void
  readonly onPriorityChange: (value: 'all' | Priority) => void
  readonly onQueueSortChange: (value: QueueSort) => void
  readonly onSelectAccount: (accountId: string) => void
  readonly onClearFilters: () => void
}

function priorityLabel(priority: Priority): string {
  if (priority === 'high') return 'High priority'
  return titleCase(priority)
}

function reviewStatusLabel(status: ReviewStatus | undefined): string {
  if (status === 'in_review') return 'In review'
  if (status === 'ready_to_escalate') return 'Ready'
  if (status === 'closed') return 'Closed'
  return 'Open'
}

export function AccountQueue({
  cases,
  totalCaseCount,
  selectedAccountId,
  searchQuery,
  priorityFilter,
  queueSort,
  reviewStatusByAccount,
  watchlistedByAccount,
  selectedOutsideFilter,
  onSearchChange,
  onPriorityChange,
  onQueueSortChange,
  onSelectAccount,
  onClearFilters,
}: AccountQueueProps) {
  const hasFilters = Boolean(searchQuery || priorityFilter !== 'all')

  return (
    <section className={styles.panel} aria-labelledby="queue-heading">
      <div className={styles.panelHeading}>
        <div>
          <div className={styles.kicker}>Prioritised review</div>
          <h2 id="queue-heading">Account queue</h2>
        </div>
        <span className={styles.count}>{totalCaseCount}</span>
      </div>

      <div className={styles.filters}>
        <label className={styles.searchBox}>
          <Search size={15} aria-hidden="true" />
          <span className="srOnly">Search account ID</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search account ID"
            aria-label="Search account ID"
          />
          {searchQuery ? (
            <button type="button" className={styles.clearSearch} onClick={() => onSearchChange('')} aria-label="Clear account search">
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <label className={styles.selectBox}>
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="srOnly">Filter queue by priority</span>
          <select value={priorityFilter} onChange={(event) => onPriorityChange(event.target.value as 'all' | Priority)} aria-label="Filter queue by priority">
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="review">Review</option>
            <option value="monitor">Monitor</option>
          </select>
        </label>
        <label className={styles.selectBox}>
          <ArrowDownAZ size={14} aria-hidden="true" />
          <span className="srOnly">Sort account queue</span>
          <select value={queueSort} onChange={(event) => onQueueSortChange(event.target.value as QueueSort)} aria-label="Sort account queue">
            <option value="score">Sort: highest score</option>
            <option value="amount">Sort: largest inflow</option>
            <option value="anchor">Sort: latest anchor</option>
          </select>
        </label>
      </div>

      <div className={styles.queueSummary}>
        <span><strong>{cases.length}</strong> shown</span>
        <span>{hasFilters ? `Filtered from ${totalCaseCount}` : 'Configured rule queue'}</span>
        <span><strong>{Object.values(watchlistedByAccount).filter(Boolean).length}</strong> watched</span>
      </div>

      {selectedOutsideFilter ? (
        <div className={styles.filterNotice} role="status">
          <span>Selected account is outside the current filter.</span>
          <button type="button" onClick={onClearFilters}>Clear filters</button>
        </div>
      ) : null}

      <div className={styles.queueList} aria-live="polite">
        {cases.length > 0 ? (
          cases.map((item) => (
            <button
              type="button"
              key={item.caseId}
              className={`${styles.queueItem} ${item.focalAccountId === selectedAccountId ? styles.queueItemSelected : ''}`}
              onClick={() => onSelectAccount(item.focalAccountId)}
              aria-current={item.focalAccountId === selectedAccountId ? 'true' : undefined}
            >
              <span className={styles.queueTopline}>
                <span className={styles.accountGroup}>
                  {watchlistedByAccount[item.focalAccountId] ? <BookmarkCheck size={13} className={styles.watchIcon} aria-label="Watchlisted" /> : <Bookmark size={13} className={styles.unwatchedIcon} aria-hidden="true" />}
                  <span className={styles.accountId}>{item.focalAccountId}</span>
                </span>
                <span className={`${styles.priority} ${styles[`priority_${item.priority}`]}`}>
                  {priorityLabel(item.priority)} <strong>{item.score}</strong>
                </span>
              </span>
              <span className={styles.queueMeta}>
                <span>{item.distinctSenders} senders</span>
                <span>{formatCompactRupees(item.incomingPaise)} in</span>
                <span className={`${styles.reviewState} ${styles[`review_${reviewStatusByAccount[item.focalAccountId] ?? 'open'}`]}`}>{reviewStatusLabel(reviewStatusByAccount[item.focalAccountId])}</span>
              </span>
              <span className={styles.queueAnchor}>Anchor {formatTime(item.anchorMs)}</span>
            </button>
          ))
        ) : (
          <div className={styles.emptyQueue}>
            <div className={styles.emptyQueueIcon} aria-hidden="true"><SlidersHorizontal size={17} /></div>
            <strong>{hasFilters ? 'No matching accounts' : 'No collection-led episodes'}</strong>
            <p>{hasFilters ? 'Try clearing the queue filters.' : 'No collection-led episodes meet the configured threshold in the observed data.'}</p>
            {hasFilters ? <button type="button" onClick={onClearFilters}>Clear filters</button> : null}
          </div>
        )}
      </div>
    </section>
  )
}
