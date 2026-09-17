import { Activity, ArrowUpRight, CircleCheck, Database, GitBranch, ShieldAlert, type LucideIcon } from 'lucide-react'
import { formatCount } from '../utils/format'
import type { AccountCase, FlowIntelligence, Transaction } from '../types'
import styles from './WorkspacePulse.module.css'

interface WorkspacePulseProps {
  readonly cases: readonly AccountCase[]
  readonly intelligenceByAccount: Readonly<Record<string, FlowIntelligence>>
  readonly loadedTransactions: number
  readonly visibleTransactions: readonly Transaction[]
  readonly analysisMode: 'local' | 'remote'
}

interface MetricCardProps {
  readonly icon: LucideIcon
  readonly iconClassName?: string
  readonly value: string
  readonly label: string
}

function MetricCard({ icon: Icon, iconClassName, value, label }: MetricCardProps) {
  return (
    <div className={styles.metric}>
      <span className={`${styles.metricIcon} ${iconClassName ?? ''}`}><Icon size={13} aria-hidden="true" /></span>
      <span>
        <b>{value}</b>
        <small>{label}</small>
      </span>
      <ArrowUpRight size={13} className={styles.metricArrow} aria-hidden="true" />
    </div>
  )
}

export function WorkspacePulse({ cases, intelligenceByAccount, loadedTransactions, visibleTransactions, analysisMode }: WorkspacePulseProps) {
  const highPriorityCount = cases.filter((item) => item.score === 100).length
  const activeSignals = Object.values(intelligenceByAccount).reduce(
    (count, intelligence) => count + intelligence.signals.filter((signal) => signal.status === 'observed').length,
    0,
  )
  const tracedPaths = Object.values(intelligenceByAccount).reduce((count, intelligence) => count + intelligence.observedPathCount, 0)
  const coverage = loadedTransactions > 0 ? Math.round((visibleTransactions.length / loadedTransactions) * 100) : 0

  return (
    <section className={styles.pulse} aria-label="Workspace pulse">
      <div className={styles.pulseIntro}>
        <div className={styles.pulseIcon}><Activity size={16} aria-hidden="true" /></div>
        <div>
          <div className={styles.eyebrow}>Workspace pulse <span className={styles.liveDot} /> {analysisMode === 'remote' ? 'API SYNCED' : 'LOCAL ENGINE'}</div>
          <strong>Evidence is ready for a focused review.</strong>
          <span>Every metric recalculates as you move the observation timeline.</span>
        </div>
      </div>
      <div className={styles.metricGrid}>
        <MetricCard icon={ShieldAlert} value={formatCount(cases.length)} label="active cases" />
        <MetricCard icon={ShieldAlert} iconClassName={styles.metricHigh} value={formatCount(highPriorityCount)} label="high priority" />
        <MetricCard icon={GitBranch} iconClassName={styles.metricGraph} value={formatCount(tracedPaths)} label="traced paths" />
        <MetricCard icon={CircleCheck} iconClassName={styles.metricSafe} value={formatCount(activeSignals)} label="graph signals" />
      </div>
      <div className={styles.coverage}><Database size={13} aria-hidden="true" /><span><b>{coverage}%</b> of loaded data visible at this cutoff</span></div>
    </section>
  )
}
