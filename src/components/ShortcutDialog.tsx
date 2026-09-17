import { X } from 'lucide-react'
import styles from './ShortcutDialog.module.css'

interface ShortcutDialogProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const shortcuts = [
  ['← / →', 'Move through the observation timeline'],
  ['R', 'Reset to before the first transfer'],
  ['E', 'Jump to the evidence panel'],
  ['G', 'Jump to the relationship graph'],
  ['?', 'Open this shortcut guide'],
]

export function ShortcutDialog({ isOpen, onClose }: ShortcutDialogProps) {
  if (!isOpen) return null
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
        <div className={styles.header}><div><span className={styles.kicker}>Analyst controls</span><h2 id="shortcut-title">Keyboard shortcuts</h2></div><button type="button" onClick={onClose} aria-label="Close keyboard shortcuts"><X size={17} aria-hidden="true" /></button></div>
        <p>Move through a case without leaving the evidence trail.</p>
        <div className={styles.shortcutList}>{shortcuts.map(([key, label]) => <div className={styles.shortcutRow} key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>
        <button type="button" className={styles.closeButton} onClick={onClose}>Done</button>
      </section>
    </div>
  )
}
