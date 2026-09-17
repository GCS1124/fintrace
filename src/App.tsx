import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth, type AuthIdentity } from './auth/authContext'
import { AuthLoadingScreen, AuthScreen } from './auth/AuthScreen'
import { AppHeader } from './components/AppHeader'
import { AccountQueue } from './components/AccountQueue'
import { AiAnalyst } from './components/AiAnalyst'
import { EmptyState } from './components/EmptyState'
import { EvidencePanel } from './components/EvidencePanel'
import { ImportDialog } from './components/ImportDialog'
import { ReplayControls } from './components/ReplayControls'
import { ShortcutDialog } from './components/ShortcutDialog'
import { buildAiAnalysisContext } from './ai/buildAiContext'
import { CSV_TEMPLATE } from './data/examples'
import { buildCaseExport, downloadCaseExport } from './export/buildCaseExport'
import { buildGraphModel } from './graph/buildGraphModel'
import { useInvestigation } from './hooks/useInvestigation'
import { saveInvestigation } from './services/workspaceService'
import { formatTime } from './utils/format'
import styles from './App.module.css'

const InvestigationGraph = lazy(() => import('./components/InvestigationGraph').then(({ InvestigationGraph: graph }) => ({ default: graph })))

function downloadTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = 'fintrace-transaction-template.csv'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

interface AuthenticatedAppProps {
  readonly identity: AuthIdentity
  readonly onSignOut: () => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function AuthenticatedApp({ identity, onSignOut }: AuthenticatedAppProps) {
  const investigation = useInvestigation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [shortcutOpen, setShortcutOpen] = useState(false)
  const importButtonRef = useRef<HTMLButtonElement>(null)

  const resetSaveState = () => {
    setSaveState('idle')
    setSaveMessage('')
  }

  const graphModel = useMemo(
    () => buildGraphModel(investigation.snapshot, investigation.selectedFocalAccountId ?? ''),
    [investigation.selectedFocalAccountId, investigation.snapshot],
  )
  const selectedTransaction = investigation.snapshot.visibleTransactions.find(
    (transaction) => transaction.id === investigation.selectedTransactionId,
  )
  const hasActivity = Boolean(
    investigation.selectedFocalAccountId &&
      investigation.snapshot.visibleTransactions.some(
        (transaction) =>
          transaction.fromAccount === investigation.selectedFocalAccountId || transaction.toAccount === investigation.selectedFocalAccountId,
      ),
  )
  const currentNote = investigation.selectedFocalAccountId
    ? investigation.notesByAccount[investigation.selectedFocalAccountId] ?? ''
    : ''
  const aiContext = useMemo(
    () => investigation.selectedFocalAccountId
      ? buildAiAnalysisContext({
          focalAccountId: investigation.selectedFocalAccountId,
          asOfMs: investigation.asOfMs,
          selectedCase: investigation.currentCase,
          intelligence: investigation.currentIntelligence,
          visibleTransactions: investigation.snapshot.visibleTransactions,
          sessionNote: currentNote,
        })
      : undefined,
    [currentNote, investigation.asOfMs, investigation.currentCase, investigation.currentIntelligence, investigation.selectedFocalAccountId, investigation.snapshot.visibleTransactions],
  )
  const observationLabel = Number.isFinite(investigation.asOfMs)
    ? formatTime(investigation.asOfMs)
    : 'Before first transfer'

  useEffect(() => {
    if (!investigation.dataset) return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (shortcutOpen) {
        if (event.key === 'Escape') setShortcutOpen(false)
        return
      }
      if (importOpen || investigation.pendingDataset) return
      if (event.key === '?') {
        event.preventDefault()
        setShortcutOpen(true)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setSaveState('idle')
        setSaveMessage('')
        investigation.previousReplay()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setSaveState('idle')
        setSaveMessage('')
        investigation.nextReplay()
        return
      }
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        setSaveState('idle')
        setSaveMessage('')
        investigation.resetReplay()
        return
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        document.getElementById('evidence-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (event.key.toLowerCase() === 'g') {
        event.preventDefault()
        document.getElementById('graph-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [importOpen, investigation.dataset, investigation.nextReplay, investigation.pendingDataset, investigation.previousReplay, investigation.resetReplay, shortcutOpen])

  const handleExport = () => {
    if (!investigation.dataset || !investigation.selectedFocalAccountId || !investigation.currentCase) return
    const payload = buildCaseExport(
      investigation.snapshot,
      investigation.selectedFocalAccountId,
      {
        sourceLabel: investigation.dataset.sourceLabel,
        sourceKind: investigation.dataset.sourceKind,
        loadedTransactionCount: investigation.dataset.transactions.length,
        fileSizeBytes: investigation.dataset.fileSizeBytes,
      },
      currentNote,
      investigation.currentIntelligence,
    )
    downloadCaseExport(payload)
    setExportMessage(`Snapshot exported for ${investigation.selectedFocalAccountId} at ${observationLabel}.`)
  }

  const handleSaveCase = async () => {
    if (!investigation.dataset || !investigation.selectedFocalAccountId || !investigation.currentCase) return
    setSaveState('saving')
    setSaveMessage('')
    try {
      const savedId = await saveInvestigation({
        ownerId: identity.id,
        dataset: investigation.dataset,
        snapshot: investigation.snapshot,
        selectedAccountId: investigation.selectedFocalAccountId,
        selectedCase: investigation.currentCase,
        intelligence: investigation.currentIntelligence,
        sessionNote: currentNote,
      })
      setSaveState('saved')
      setSaveMessage(`Case saved to your private workspace · ${savedId.slice(0, 8)}.`)
    } catch (error) {
      setSaveState('error')
      setSaveMessage(error instanceof Error ? error.message : 'Could not save this case.')
    }
  }

  const selectExample = (exampleId: string) => {
    setMenuOpen(false)
    setExportMessage('')
    resetSaveState()
    investigation.loadExample(exampleId)
  }

  const openImport = () => {
    setMenuOpen(false)
    setExportMessage('')
    setImportOpen(true)
  }

  const handleDownloadTemplate = () => {
    setMenuOpen(false)
    downloadTemplate()
  }

  const commonHeaderProps = {
    hasDataset: Boolean(investigation.dataset),
    canSaveCase: Boolean(investigation.selectedFocalAccountId && investigation.currentCase),
    menuOpen,
    onToggleMenu: () => setMenuOpen((open) => !open),
    onSelectExample: selectExample,
    onOpenImport: openImport,
    onDownloadTemplate: handleDownloadTemplate,
    importButtonRef,
    identity,
    saveState,
    onSaveCase: () => void handleSaveCase(),
    onSignOut,
  }

  if (!investigation.dataset) {
    return (
      <div className={styles.app}>
        <AppHeader {...commonHeaderProps} />
        <EmptyState onLoadDemo={() => investigation.loadExample('split-reconverge')} onImport={openImport} onDownloadTemplate={downloadTemplate} />
        {importOpen ? (
          <ImportDialog
            isOpen
            returnFocusRef={importButtonRef}
            onClose={() => setImportOpen(false)}
            onImport={(dataset) => {
              resetSaveState()
              investigation.loadUploadedDataset(dataset)
            }}
            onDownloadTemplate={downloadTemplate}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <AppHeader {...commonHeaderProps} />

      <main className={styles.content}>
        <section className={styles.workspace} aria-label="FINTRACE investigation workspace">
          <AccountQueue
            cases={investigation.filteredCases}
            totalCaseCount={investigation.snapshot.cases.length}
            selectedAccountId={investigation.selectedFocalAccountId}
            searchQuery={investigation.searchQuery}
            priorityFilter={investigation.priorityFilter}
            queueSort={investigation.queueSort}
            reviewStatusByAccount={investigation.reviewStatusByAccount}
            watchlistedByAccount={investigation.watchlistedByAccount}
            selectedOutsideFilter={investigation.selectedOutsideFilter}
            onSearchChange={investigation.setSearchQuery}
            onPriorityChange={investigation.setPriorityFilter}
            onQueueSortChange={investigation.setQueueSort}
            onSelectAccount={(accountId) => {
              resetSaveState()
              investigation.selectAccount(accountId)
            }}
            onClearFilters={investigation.clearFilters}
          />

          <div className={styles.graphColumn}>
            <section id="graph-panel" className={styles.graphPanel} aria-labelledby="graph-heading">
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.kicker}>Transaction graph</div>
                  <h2 id="graph-heading">Observed transaction trail</h2>
                </div>
                <div className={styles.graphHeaderMeta}>
                  <div className={styles.focusMeta}>
                    <span>Focal account</span>
                    <strong>{investigation.selectedFocalAccountId ?? '—'}</strong>
                  </div>
                  <span className={styles.graphCounts}>{graphModel.nodes.length} accounts · {graphModel.edges.length} transfers</span>
                </div>
              </div>
              <div className={styles.graphContext}>
                <div>
                  <span>Current observation</span>
                  <strong>{observationLabel}</strong>
                </div>
                {investigation.currentCase ? (
                  <div className={`${styles.scoreChip} ${styles[`score_${investigation.currentCase.priority}`]}`}>
                    <ShieldCheck size={13} aria-hidden="true" />
                    {investigation.currentCase.score}/100 {investigation.currentCase.priority === 'high' ? 'High priority' : investigation.currentCase.priority}
                  </div>
                ) : (
                  <span className={styles.noCaseChip}>No qualifying case</span>
                )}
              </div>
              <Suspense fallback={<div className={styles.graphLoading} role="status"><LoaderCircle size={18} className={styles.spin} />Loading relationship graph…</div>}>
                <InvestigationGraph
                  model={graphModel}
                  selectedTransaction={selectedTransaction}
                  selectedNodeId={investigation.selectedNodeId}
                  onSelectTransaction={investigation.setSelectedTransactionId}
                  onSelectNode={investigation.setSelectedNodeId}
                  onFitView={() => undefined}
                />
              </Suspense>
              <div className={styles.graphFootnote}>
                <span>Click a node to highlight its visible connections or an arrow to inspect that transfer.</span>
                <span>Graph display limit: 24 nodes / 60 edges.</span>
              </div>
            </section>

            <ReplayControls
              index={investigation.replayIndex}
              timeline={investigation.timeline}
              asOfMs={investigation.asOfMs}
              totalLoaded={investigation.dataset.transactions.length}
              visibleCount={investigation.snapshot.visibleTransactions.length}
              onReset={() => {
                resetSaveState()
                investigation.resetReplay()
              }}
              onPrevious={() => {
                resetSaveState()
                investigation.previousReplay()
              }}
              onNext={() => {
                resetSaveState()
                investigation.nextReplay()
              }}
              onChange={(index) => {
                resetSaveState()
                investigation.goToReplayIndex(index)
              }}
            />
          </div>

          <EvidencePanel
            id="evidence-panel"
            selectedCase={investigation.currentCase}
            intelligence={investigation.currentIntelligence}
            focalAccountId={investigation.selectedFocalAccountId}
            visibleTransactions={investigation.snapshot.visibleTransactions}
            selectedTransactionId={investigation.selectedTransactionId}
            note={currentNote}
            scenarioNote={investigation.dataset.scenarioNote}
            hasActivity={hasActivity}
            onSelectTransaction={investigation.setSelectedTransactionId}
            onNoteChange={(value) => {
              if (investigation.selectedFocalAccountId) investigation.updateNote(investigation.selectedFocalAccountId, value)
            }}
            onExport={handleExport}
          />
        </section>

        <div id="ai-analyst-panel">
          <AiAnalyst context={aiContext} onSelectTransaction={investigation.setSelectedTransactionId} />
        </div>

        <footer className={styles.footer}>
          <span><ShieldCheck size={13} aria-hidden="true" /> FINTRACE supports human review; it does not confirm fraud.</span>
          <span>Session memory · refresh clears notes and loaded data</span>
        </footer>
        {exportMessage ? <div className={styles.toast} role="status">{exportMessage}</div> : null}
        {saveMessage ? <div className={`${styles.toast} ${saveState === 'error' ? styles.toastError : ''}`} role={saveState === 'error' ? 'alert' : 'status'}>{saveMessage}</div> : null}
      </main>

      {importOpen ? (
        <ImportDialog
          isOpen
          returnFocusRef={importButtonRef}
          onClose={() => setImportOpen(false)}
          onImport={(dataset) => {
            resetSaveState()
            investigation.loadUploadedDataset(dataset)
          }}
          onDownloadTemplate={downloadTemplate}
        />
      ) : null}

      {investigation.pendingDataset ? (
        <div className={styles.confirmBackdrop} role="presentation">
          <section className={styles.confirmDialog} role="dialog" aria-modal="true" aria-labelledby="replace-title">
            <div className={styles.confirmIcon} aria-hidden="true"><AlertTriangle size={18} /></div>
            <h2 id="replace-title">Replace this investigation?</h2>
            <p>Loading <strong>{investigation.pendingDataset.sourceLabel}</strong> will clear the current session note and replace the active dataset. This cannot be undone after the switch.</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancelButton} onClick={investigation.cancelPendingDataset}>Keep current data</button>
              <button
                type="button"
                className={styles.replaceButton}
                onClick={() => {
                  resetSaveState()
                  investigation.confirmPendingDataset()
                }}
              >
                Replace dataset
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <ShortcutDialog isOpen={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </div>
  )
}

function App() {
  const auth = useAuth()

  if (auth.status === 'loading') return <AuthLoadingScreen />
  if (!auth.identity) {
    return (
      <AuthScreen
        configured={auth.configured}
        allowDemo={!auth.configured && import.meta.env.DEV}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onResetPassword={auth.resetPassword}
        onContinueDemo={auth.continueDemo}
      />
    )
  }

  return <AuthenticatedApp identity={auth.identity} onSignOut={() => void auth.signOut()} />
}

export default App
