import { useState } from 'react'
import { ChevronDown, Download, FileWarning, Info, NotebookPen } from 'lucide-react'
import { formatRupees } from '../engine/money'
import { formatTime } from '../utils/format'
import type { AccountCase, FlowIntelligence, SignalResult, Transaction } from '../types'
import styles from './EvidencePanel.module.css'

interface EvidencePanelProps {
  readonly id?: string
  readonly selectedCase: AccountCase | undefined
  readonly intelligence: FlowIntelligence | undefined
  readonly focalAccountId: string | undefined
  readonly visibleTransactions: readonly Transaction[]
  readonly selectedTransactionId: string | undefined
  readonly note: string
  readonly scenarioNote: string | undefined
  readonly hasActivity: boolean
  readonly onSelectTransaction: (transactionId: string) => void
  readonly onNoteChange: (value: string) => void
  readonly onExport: () => void
}

function statusLabel(status: SignalResult['status']): string {
  if (status === 'triggered') return 'Triggered'
  if (status === 'pending') return 'Pending'
  return 'Not observed'
}

function statusClass(status: SignalResult['status']): string {
  if (status === 'triggered') return styles.statusTriggered
  if (status === 'pending') return styles.statusPending
  return styles.statusNotObserved
}

function signalDetail(signal: SignalResult): string[] {
  if (signal.id === 'collection') {
    return [
      `${signal.observed.distinctSenders} distinct senders`,
      formatRupees(Number(signal.observed.incomingPaise)) + ' received',
      `Window ends at ${formatTime(Number(signal.observed.anchorMs))}`,
    ]
  }
  if (signal.id === 'forwarding') {
    return [
      `${formatRupees(Number(signal.observed.outgoingPaise))} outward observed`,
      `${signal.observed.observedOutflowPercent} of ${formatRupees(Number(signal.observed.incomingPaise))} incoming`,
      `Threshold: ${signal.observed.thresholdPercent}% within 5 minutes`,
    ]
  }
  return [
    signal.observed.commonRecipient === 'none observed'
      ? 'No common recipient witness yet'
      : `Common recipient: ${signal.observed.commonRecipient}`,
    `${signal.observed.branchCount} distinct outward branch${signal.observed.branchCount === 1 ? '' : 'es'} observed`,
    `Witness deadline: ${formatTime(Number(signal.observed.witnessDeadlineMs))}`,
  ]
}

function signalEvidence(signal: SignalResult): string {
  if (signal.evidenceTransactionIds.length === 0) return 'No supporting transfers at this cutoff.'
  return `Linked transfers: ${signal.evidenceTransactionIds.join(', ')}`
}

function SignalRow({ signal }: { readonly signal: SignalResult }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className={`${styles.signalRow} ${isOpen ? styles.signalRowOpen : ''}`}>
      <button type="button" className={styles.signalButton} onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
        <span className={styles.signalIcon}><span /></span>
        <span className={styles.signalCopy}>
          <strong>{signal.title}</strong>
          <small>{signal.status === 'triggered' ? signal.explanation : statusLabel(signal.status)}</small>
        </span>
        <span className={styles.signalRight}>
          <span className={`${styles.signalStatus} ${statusClass(signal.status)}`}>{statusLabel(signal.status)}</span>
          <strong className={styles.points}>{signal.points > 0 ? `+${signal.points}` : '—'}</strong>
          <ChevronDown size={15} className={isOpen ? styles.chevronOpen : ''} aria-hidden="true" />
        </span>
      </button>
      {isOpen ? (
        <div className={styles.signalDetail}>
          <p>{signal.explanation}</p>
          <div className={styles.observedGrid}>
            {signalDetail(signal).map((detail) => <span key={detail}>{detail}</span>)}
          </div>
          <code>{signalEvidence(signal)}</code>
        </div>
      ) : null}
    </div>
  )
}

export function EvidencePanel({
  id,
  selectedCase,
  intelligence,
  focalAccountId,
  visibleTransactions,
  selectedTransactionId,
  note,
  scenarioNote,
  hasActivity,
  onSelectTransaction,
  onNoteChange,
  onExport,
}: EvidencePanelProps) {
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(Boolean(note))
  const evidenceIds = new Set(selectedCase?.evidenceTransactionIds ?? [])
  intelligence?.signals.forEach((signal) => signal.evidenceTransactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  intelligence?.paths.forEach((path) => path.transactionIds.forEach((transactionId) => evidenceIds.add(transactionId)))
  const evidenceTransactions = visibleTransactions.filter((transaction) => evidenceIds.has(transaction.id))

  return (
    <section id={id} className={styles.panel} aria-labelledby="evidence-heading">
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.kicker}>Explainable signals</div>
          <h2 id="evidence-heading">Evidence</h2>
        </div>
        <Info size={16} className={styles.headerIcon} aria-hidden="true" />
      </div>

      {selectedCase ? (
        <>
          <div className={`${styles.scoreCard} ${styles[`score_${selectedCase.priority}`]}`}>
            <div>
              <span>Review priority</span>
              <strong>{selectedCase.score}<small>/100</small></strong>
            </div>
            <span className={styles.notProbability}>Not a fraud probability</span>
          </div>
          <div className={styles.ruleHeading}>
            <span>Configured checks</span>
            <span>Points</span>
          </div>
          <div className={styles.signalList}>
            {selectedCase.signals.map((signal) => <SignalRow key={signal.id} signal={signal} />)}
          </div>

          {scenarioNote ? (
            <div className={styles.scenarioNote} role="note">
              <FileWarning size={15} aria-hidden="true" />
              <span><strong>Evaluation context</strong>{scenarioNote}</span>
            </div>
          ) : null}

          <div className={styles.disclosureGroup}>
            <button type="button" className={styles.disclosureButton} onClick={() => setTransactionsOpen((open) => !open)} aria-expanded={transactionsOpen}>
              <span><span className={styles.disclosureGlyph}>↳</span> Evidence rows <small>{evidenceTransactions.length}</small></span>
              <ChevronDown size={15} className={transactionsOpen ? styles.chevronOpen : ''} aria-hidden="true" />
            </button>
            {transactionsOpen ? (
              <div className={styles.transactionTableWrap}>
                {evidenceTransactions.length > 0 ? (
                  <table className={styles.transactionTable}>
                    <thead><tr><th>Time</th><th>Transfer</th><th>Amount</th></tr></thead>
                    <tbody>
                      {evidenceTransactions.map((transaction) => (
                        <tr key={transaction.id} className={selectedTransactionId === transaction.id ? styles.transactionSelected : ''}>
                          <td>{formatTime(transaction.timestampMs)}</td>
                          <td>
                            <button type="button" onClick={() => onSelectTransaction(transaction.id)} title={`Select ${transaction.id}`}>
                              <span className={styles.transactionId}>{transaction.id}</span>
                              <span className={styles.route}>{transaction.fromAccount} <b>→</b> {transaction.toAccount}</span>
                            </button>
                          </td>
                          <td className={styles.amount}>{formatRupees(transaction.amountPaise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className={styles.emptyEvidence}>No supporting transfers are visible at this cutoff.</p>}
              </div>
            ) : null}
          </div>

          <div className={styles.disclosureGroup}>
            <button type="button" className={styles.disclosureButton} onClick={() => setNoteOpen((open) => !open)} aria-expanded={noteOpen}>
              <span><NotebookPen size={14} aria-hidden="true" /> Session note <small>Local only</small></span>
              <ChevronDown size={15} className={noteOpen ? styles.chevronOpen : ''} aria-hidden="true" />
            </button>
            {noteOpen ? (
              <div className={styles.noteBody}>
                <label htmlFor="session-note">Context for {focalAccountId}</label>
                <textarea
                  id="session-note"
                  value={note}
                  maxLength={1000}
                  onChange={(event) => onNoteChange(event.target.value)}
                  placeholder="Add context for the current review…"
                  rows={4}
                />
                <div className={styles.noteMeta}><span>Not saved after refresh</span><span>{note.length}/1,000</span></div>
              </div>
            ) : null}
          </div>

          <div className={styles.limitations}>
            <span>Scope reminder</span>
            <p>Observed pattern evidence supports human review. Unknown balances mean this view does not prove ownership or loss.</p>
          </div>
          <button type="button" className={styles.exportButton} onClick={onExport}>
            <Download size={15} aria-hidden="true" /> Export JSON snapshot
          </button>
        </>
      ) : (
        <div className={styles.noCase}>
          <div className={styles.noCaseIcon} aria-hidden="true"><Info size={17} /></div>
          <strong>{hasActivity ? 'No qualifying case at this cutoff' : 'No activity for this account at the selected time'}</strong>
          <p>{hasActivity ? 'This account has visible transfers, but fewer than six distinct incoming senders meet the configured collection rule.' : 'Future transfers stay hidden until the timeline reaches them.'}</p>
        </div>
      )}
    </section>
  )
}
