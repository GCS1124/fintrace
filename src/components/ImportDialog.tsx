import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { AlertCircle, CheckCircle2, Download, FileText, LoaderCircle, Upload, X } from 'lucide-react'
import { parseCsvFile } from '../engine/validate'
import { formatRupees } from '../engine/money'
import { formatTime } from '../utils/format'
import type { LoadedDataset } from '../hooks/useInvestigation'
import type { ValidationResult } from '../types'
import styles from './ImportDialog.module.css'

interface ImportDialogProps {
  readonly isOpen: boolean
  readonly returnFocusRef: RefObject<HTMLButtonElement | null>
  readonly onClose: () => void
  readonly onImport: (dataset: Omit<LoadedDataset, 'sessionId'>) => void
  readonly onDownloadTemplate: () => void
}

export function ImportDialog({ isOpen, returnFocusRef, onClose, onImport, onDownloadTemplate }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const browseButtonRef = useRef<HTMLButtonElement>(null)
  const validationToken = useRef(0)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState<number | undefined>()
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const frame = window.requestAnimationFrame(() => browseButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const closeDialog = () => {
    onClose()
    window.requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  const validateFile = async (file: File | undefined) => {
    if (!file) return
    const token = ++validationToken.current
    setFileName(file.name)
    setFileSize(file.size)
    setResult(null)
    setIsValidating(true)
    const nextResult = await parseCsvFile(file)
    if (token !== validationToken.current) return
    setResult(nextResult)
    setIsValidating(false)
  }

  if (!isOpen) return null

  const canImport = Boolean(result?.ok && !isValidating)
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby="import-description">
        <div className={styles.dialogHeader}>
          <div>
            <div className={styles.eyebrow}>SAFE DATA INTAKE</div>
            <h2 id="import-title">Import transaction CSV</h2>
            <p id="import-description">Validate the complete file before it enters the investigation.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={closeDialog} aria-label="Close import dialog">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.dialogBody}>
          <div
            className={`${styles.dropZone} ${fileName ? styles.dropZoneSelected : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void validateFile(event.dataTransfer.files?.[0])
            }}
          >
            <div className={styles.uploadIcon} aria-hidden="true"><Upload size={19} /></div>
            <strong>{fileName || 'Choose a CSV file'}</strong>
            <span>{fileName ? `${fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : ''} · reselect to validate another file` : 'Drop it here or browse from your device'}</span>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => void validateFile(event.target.files?.[0])} />
            <button ref={browseButtonRef} type="button" className={styles.browseButton} onClick={() => fileInputRef.current?.click()}>
              Browse CSV
            </button>
          </div>

          <div className={styles.contractNote}>
            <FileText size={15} aria-hidden="true" />
            <span><strong>Required:</strong> transaction_id, timestamp, from_account, to_account, amount, currency</span>
          </div>
          <div className={styles.limits}>
            <span>Up to 2 MiB</span><span>2,000 rows</span><span>INR only</span><span>Explicit timezone required</span>
          </div>

          {isValidating ? (
            <div className={styles.statusBox} role="status"><LoaderCircle className={styles.spin} size={17} /> Checking every row…</div>
          ) : null}

          {result && !isValidating ? (
            <div className={result.ok ? styles.successBox : styles.errorBox} role={result.ok ? 'status' : 'alert'}>
              {result.ok ? <CheckCircle2 size={17} aria-hidden="true" /> : <AlertCircle size={17} aria-hidden="true" />}
              <div>
                <strong>{result.ok ? `Ready to import ${result.transactions.length} transactions` : 'Import rejected'}</strong>
                <span>{result.ok ? 'Only whitelisted, normalised fields will enter the engine.' : `${result.errors.length} issue${result.errors.length === 1 ? '' : 's'} found. The active dataset is unchanged.`}</span>
              </div>
            </div>
          ) : null}

          {result && !result.ok ? (
            <div className={styles.errorList}>
              <div className={styles.sectionLabel}>Validation details</div>
              <ul>
                {result.errors.slice(0, 5).map((error, index) => (
                  <li key={`${error.row ?? 'file'}-${error.field ?? 'issue'}-${index}`}>
                    <span>{error.row ? `Row ${error.row}` : 'File'}</span>{error.field ? ` · ${error.field}` : ''}: {error.message}
                  </li>
                ))}
              </ul>
              {result.errors.length > 5 ? <p>Showing 5 of {result.errors.length} issues.</p> : null}
            </div>
          ) : null}

          {result?.ok && result.warnings.length > 0 ? (
            <div className={styles.warningBox} role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{result.warnings.join(' ')}</span>
            </div>
          ) : null}

          {result?.ok ? (
            <div className={styles.previewSection}>
              <div className={styles.previewHeading}>
                <div><div className={styles.sectionLabel}>Preview</div><span>First 5 normalised rows</span></div>
                <span>{result.transactions.length} rows total</span>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>ID</th><th>Time (IST)</th><th>Route</th><th>Amount</th></tr></thead>
                  <tbody>
                    {result.transactions.slice(0, 5).map((transaction) => (
                      <tr key={transaction.id}>
                        <td className={styles.mono}>{transaction.id}</td>
                        <td>{formatTime(transaction.timestampMs)}</td>
                        <td className={styles.route}>{transaction.fromAccount} <span>→</span> {transaction.toAccount}</td>
                        <td className={styles.amount}>{formatRupees(transaction.amountPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <button type="button" className={styles.templateLink} onClick={onDownloadTemplate}>
            <Download size={14} aria-hidden="true" /> Download the compatible CSV template
          </button>
        </div>

        <div className={styles.dialogFooter}>
          <button type="button" className={styles.cancelButton} onClick={closeDialog}>Cancel</button>
          <button
            type="button"
            className={styles.importAction}
            disabled={!canImport}
            onClick={() => {
              if (!result?.ok || !fileName) return
              onImport({
                sourceLabel: fileName,
                sourceKind: 'uploaded',
                description: 'User-supplied CSV transaction records.',
                transactions: result.transactions,
                fileSizeBytes: fileSize,
                warnings: result.warnings,
              })
              closeDialog()
            }}
          >
            Import validated data
          </button>
        </div>
      </section>
    </div>
  )
}
