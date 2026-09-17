import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DETECTOR_CONFIG } from '../config/detector'
import { EXAMPLE_DATASETS } from '../data/examples'
import { analyzeSnapshot } from '../engine/analyze'
import { enrichSnapshot } from '../engine/intelligentAnalyze'
import { requestServerAnalysis, type ServerAnalysisResult } from '../services/analysisService'
import type { AccountCase, AnalysisSnapshot, FlowIntelligence, Priority, ReviewStatus, Transaction } from '../types'

export interface LoadedDataset {
  readonly sessionId: string
  readonly sourceLabel: string
  readonly sourceKind: 'synthetic' | 'uploaded'
  readonly description: string
  readonly transactions: readonly Transaction[]
  readonly fileSizeBytes?: number
  readonly warnings: readonly string[]
  readonly scenarioNote?: string
}

export type PendingDataset = LoadedDataset

interface SyncedAnalysis extends ServerAnalysisResult {
  readonly sessionId: string
}

export type QueueSort = 'score' | 'amount' | 'anchor'

function makeTimeline(transactions: readonly Transaction[]): number[] {
  return [
    Number.NEGATIVE_INFINITY,
    ...[...new Set(transactions.map((transaction) => transaction.timestampMs))].sort((left, right) => left - right),
  ]
}

function getDefaultAccount(snapshot: AnalysisSnapshot): string | undefined {
  return snapshot.cases[0]?.focalAccountId ?? snapshot.visibleAccountIds[0]
}

function hasNote(notes: Readonly<Record<string, string>>): boolean {
  return Object.values(notes).some((note) => note.trim().length > 0)
}

export function useInvestigation() {
  const [dataset, setDataset] = useState<LoadedDataset | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [selectedFocalAccountId, setSelectedFocalAccountId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [queueSort, setQueueSort] = useState<QueueSort>('score')
  const [notesByAccount, setNotesByAccount] = useState<Record<string, string>>({})
  const [reviewStatusByAccount, setReviewStatusByAccount] = useState<Record<string, ReviewStatus>>({})
  const [watchlistedByAccount, setWatchlistedByAccount] = useState<Record<string, boolean>>({})
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | undefined>()
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>()
  const [pendingDataset, setPendingDataset] = useState<PendingDataset | null>(null)
  const [serverAnalysis, setServerAnalysis] = useState<SyncedAnalysis | null>(null)
  const loadSequence = useRef(0)

  const timeline = useMemo(() => makeTimeline(dataset?.transactions ?? []), [dataset])
  const asOfMs = timeline[replayIndex] ?? Number.NEGATIVE_INFINITY
  const snapshot = useMemo(
    () => analyzeSnapshot(dataset?.transactions ?? [], asOfMs, DETECTOR_CONFIG),
    [dataset, asOfMs],
  )
  const localIntelligenceByAccount = useMemo(
    () => enrichSnapshot(snapshot, DETECTOR_CONFIG),
    [snapshot],
  )

  useEffect(() => {
    if (!dataset || !Number.isFinite(asOfMs)) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void requestServerAnalysis(dataset.transactions, asOfMs, selectedFocalAccountId, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          setServerAnalysis({ ...result, sessionId: dataset.sessionId })
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === 'AbortError') return
          // The local engine remains authoritative when the optional API is unavailable.
        })
    }, 120)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [asOfMs, dataset, selectedFocalAccountId])

  const hasRemoteAnalysis = Boolean(
    serverAnalysis &&
      dataset &&
      serverAnalysis.sessionId === dataset.sessionId &&
      serverAnalysis.asOfMs === asOfMs,
  )
  const activeServerAnalysis = hasRemoteAnalysis ? serverAnalysis : null
  const intelligenceByAccount = activeServerAnalysis
    ? activeServerAnalysis.intelligenceByAccount
    : localIntelligenceByAccount
  const currentIntelligence: FlowIntelligence | undefined = selectedFocalAccountId
    ? intelligenceByAccount[selectedFocalAccountId]
    : undefined

  const currentCase = useMemo<AccountCase | undefined>(
    () => snapshot.cases.find((item) => item.focalAccountId === selectedFocalAccountId),
    [selectedFocalAccountId, snapshot.cases],
  )

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = snapshot.cases.filter((item) => {
      const matchesQuery = !query || item.focalAccountId.toLowerCase().includes(query)
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter
      return matchesQuery && matchesPriority
    })
    return [...filtered].sort((left, right) => {
      if (queueSort === 'amount') return right.incomingPaise - left.incomingPaise || right.score - left.score
      if (queueSort === 'anchor') return right.anchorMs - left.anchorMs || right.score - left.score
      return right.score - left.score || right.incomingPaise - left.incomingPaise || left.focalAccountId.localeCompare(right.focalAccountId)
    })
  }, [priorityFilter, queueSort, searchQuery, snapshot.cases])

  const selectedOutsideFilter = Boolean(
    selectedFocalAccountId && currentCase && !filteredCases.some((item) => item.focalAccountId === selectedFocalAccountId),
  )

  const commitDataset = useCallback((nextDataset: LoadedDataset) => {
    const nextTimeline = makeTimeline(nextDataset.transactions)
    const nextAsOfMs = nextTimeline[nextTimeline.length - 1] ?? Number.NEGATIVE_INFINITY
    const nextSnapshot = analyzeSnapshot(nextDataset.transactions, nextAsOfMs, DETECTOR_CONFIG)
    setDataset(nextDataset)
    setReplayIndex(Math.max(nextTimeline.length - 1, 0))
    setSearchQuery('')
    setPriorityFilter('all')
    setQueueSort('score')
    setNotesByAccount({})
    setReviewStatusByAccount({})
    setWatchlistedByAccount({})
    setServerAnalysis(null)
    setSelectedFocalAccountId(getDefaultAccount(nextSnapshot))
    setSelectedTransactionId(undefined)
    setSelectedNodeId(undefined)
    setPendingDataset(null)
  }, [])

  const requestDatasetLoad = useCallback(
    (nextDataset: Omit<LoadedDataset, 'sessionId'>) => {
      loadSequence.current += 1
      const stampedDataset: LoadedDataset = {
        ...nextDataset,
        sessionId: `${nextDataset.sourceLabel}-${loadSequence.current}`,
      }
      if (dataset && hasNote(notesByAccount)) {
        setPendingDataset(stampedDataset)
      } else {
        commitDataset(stampedDataset)
      }
    },
    [commitDataset, dataset, notesByAccount],
  )

  const loadExample = useCallback(
    (exampleId: string) => {
      const example = EXAMPLE_DATASETS.find((item) => item.id === exampleId)
      if (!example) return
      requestDatasetLoad({
        sourceLabel: example.label,
        sourceKind: 'synthetic',
        description: example.description,
        transactions: example.transactions,
        warnings: [],
        ...(example.scenarioNote ? { scenarioNote: example.scenarioNote } : {}),
      })
    },
    [requestDatasetLoad],
  )

  const loadUploadedDataset = useCallback(
    (uploaded: Omit<LoadedDataset, 'sessionId'>) => requestDatasetLoad(uploaded),
    [requestDatasetLoad],
  )

  const updateNote = useCallback(
    (accountId: string, value: string) => {
      setNotesByAccount((current) => ({ ...current, [accountId]: value.slice(0, 1_000) }))
    },
    [],
  )

  const setReviewStatus = useCallback(
    (status: ReviewStatus) => {
      if (!selectedFocalAccountId) return
      setReviewStatusByAccount((current) => ({ ...current, [selectedFocalAccountId]: status }))
    },
    [selectedFocalAccountId],
  )

  const toggleWatchlist = useCallback(() => {
    if (!selectedFocalAccountId) return
    setWatchlistedByAccount((current) => ({ ...current, [selectedFocalAccountId]: !current[selectedFocalAccountId] }))
  }, [selectedFocalAccountId])

  const selectAccount = useCallback((accountId: string) => {
    setSelectedFocalAccountId(accountId)
    setSelectedTransactionId(undefined)
    setSelectedNodeId(undefined)
  }, [])

  const goToReplayIndex = useCallback(
    (index: number) => setReplayIndex(Math.min(Math.max(index, 0), Math.max(timeline.length - 1, 0))),
    [timeline.length],
  )

  const resetReplay = useCallback(() => goToReplayIndex(0), [goToReplayIndex])
  const previousReplay = useCallback(() => goToReplayIndex(replayIndex - 1), [goToReplayIndex, replayIndex])
  const nextReplay = useCallback(() => goToReplayIndex(replayIndex + 1), [goToReplayIndex, replayIndex])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setPriorityFilter('all')
  }, [])

  const cancelPendingDataset = useCallback(() => setPendingDataset(null), [])
  const confirmPendingDataset = useCallback(() => {
    if (pendingDataset) commitDataset(pendingDataset)
  }, [commitDataset, pendingDataset])

  return {
    dataset,
    snapshot,
    timeline,
    asOfMs,
    replayIndex,
    currentCase,
    currentIntelligence,
    currentReviewStatus: selectedFocalAccountId ? reviewStatusByAccount[selectedFocalAccountId] ?? 'open' : 'open' as ReviewStatus,
    currentWatchlisted: selectedFocalAccountId ? Boolean(watchlistedByAccount[selectedFocalAccountId]) : false,
    intelligenceByAccount,
    analysisMode: hasRemoteAnalysis ? 'remote' as const : 'local' as const,
    filteredCases,
    selectedFocalAccountId,
    selectedOutsideFilter,
    searchQuery,
    priorityFilter,
    queueSort,
    notesByAccount,
    reviewStatusByAccount,
    watchlistedByAccount,
    selectedTransactionId,
    selectedNodeId,
    pendingDataset,
    setSearchQuery,
    setPriorityFilter,
    setQueueSort,
    setReviewStatus,
    toggleWatchlist,
    setSelectedTransactionId,
    setSelectedNodeId,
    loadExample,
    loadUploadedDataset,
    selectAccount,
    updateNote,
    goToReplayIndex,
    resetReplay,
    previousReplay,
    nextReplay,
    clearFilters,
    cancelPendingDataset,
    confirmPendingDataset,
  }
}
