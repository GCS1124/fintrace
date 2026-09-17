import { ChevronsLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatTime } from '../utils/format'
import styles from './ReplayControls.module.css'

interface ReplayControlsProps {
  readonly index: number
  readonly timeline: readonly number[]
  readonly asOfMs: number
  readonly totalLoaded: number
  readonly visibleCount: number
  readonly onReset: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
  readonly onChange: (index: number) => void
}

export function ReplayControls({
  index,
  timeline,
  asOfMs,
  totalLoaded,
  visibleCount,
  onReset,
  onPrevious,
  onNext,
  onChange,
}: ReplayControlsProps) {
  const maxIndex = Math.max(timeline.length - 1, 0)
  const isBeforeFirst = !Number.isFinite(asOfMs)
  const readout = isBeforeFirst ? 'Before first transfer' : formatTime(asOfMs)
  const stepLabel = `${Math.min(index + 1, timeline.length)} of ${timeline.length}`

  return (
    <section className={styles.panel} aria-label="Timeline replay controls">
      <div className={styles.panelHeading}>
        <div>
          <div className={styles.kicker}>Evidence timeline</div>
          <h2>Replay the observation</h2>
        </div>
        <span className={styles.stepBadge}>Step {stepLabel}</span>
      </div>
      <div className={styles.controls}>
        <div className={styles.buttonGroup}>
          <button type="button" className={styles.controlButton} onClick={onReset} disabled={index === 0}>
            <ChevronsLeft size={15} aria-hidden="true" /> Reset
          </button>
          <button type="button" className={styles.controlButton} onClick={onPrevious} disabled={index === 0}>
            <ChevronLeft size={15} aria-hidden="true" /> Previous
          </button>
          <button type="button" className={`${styles.controlButton} ${styles.nextButton}`} onClick={onNext} disabled={index >= maxIndex}>
            Next <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>Current observation</span>
          <strong>{readout}</strong>
        </div>
      </div>

      <div className={styles.sliderRow}>
        <span className={styles.edgeLabel}>Start</span>
        <div className={styles.sliderWrap}>
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={Math.min(index, maxIndex)}
            onChange={(event) => onChange(Number(event.target.value))}
            aria-label="Observed timeline position"
            aria-valuetext={readout}
          />
          <div className={styles.ticks} aria-hidden="true">
            {timeline.map((timestamp, timestampIndex) => (
              <span key={`${timestamp}-${timestampIndex}`} className={timestampIndex <= index ? styles.tickActive : ''} />
            ))}
          </div>
        </div>
        <span className={styles.edgeLabel}>End</span>
      </div>

      <div className={styles.timelineMeta}>
        <span><strong>{visibleCount}</strong> of {totalLoaded} loaded rows visible</span>
        <span>One step = one unique timestamp · use the slider to move through time</span>
      </div>
    </section>
  )
}
