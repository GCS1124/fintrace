export interface Transaction {
  readonly id: string
  readonly timestampMs: number
  readonly fromAccount: string
  readonly toAccount: string
  readonly amountPaise: number
  readonly currency: 'INR'
}

export type SignalId = 'collection' | 'forwarding' | 'reconvergence'
export type SignalStatus = 'triggered' | 'pending' | 'not_observed'
export type Priority = 'monitor' | 'review' | 'high'
export type ReviewStatus = 'open' | 'in_review' | 'ready_to_escalate' | 'closed'
export type IntelligenceSignalId = 'fan_out' | 'layering' | 'circular' | 'velocity'
export type IntelligenceSignalStatus = 'observed' | 'not_observed'

export interface SignalResult {
  readonly id: SignalId
  readonly status: SignalStatus
  readonly points: number
  readonly title: string
  readonly explanation: string
  readonly observed: Readonly<Record<string, number | string>>
  readonly evidenceTransactionIds: readonly string[]
}

export interface ReconvergenceWitness {
  readonly destinationAccountId: string
  readonly firstHopTransactionId: string
  readonly secondHopTransactionId: string
  readonly firstOnwardTransactionId: string
  readonly secondOnwardTransactionId: string
}

export interface AccountCase {
  readonly caseId: string
  readonly focalAccountId: string
  readonly anchorMs: number
  readonly score: 30 | 70 | 100
  readonly priority: Priority
  readonly distinctSenders: number
  readonly incomingPaise: number
  readonly outgoingPaise: number
  readonly signals: readonly SignalResult[]
  readonly evidenceTransactionIds: readonly string[]
  readonly warnings: readonly string[]
  readonly reconvergenceWitness?: ReconvergenceWitness
}

export type FlowPathKind = 'chain' | 'cycle'

export interface FlowPath {
  readonly pathId: string
  readonly kind: FlowPathKind
  readonly accountIds: readonly string[]
  readonly transactionIds: readonly string[]
  /** The smallest observed transfer on the path; not a claim of exact ownership. */
  readonly bottleneckPaise: number
  readonly startMs: number
  readonly endMs: number
  readonly depth: number
}

export interface IntelligenceSignal {
  readonly id: IntelligenceSignalId
  readonly status: IntelligenceSignalStatus
  readonly points: number
  readonly title: string
  readonly explanation: string
  readonly evidenceTransactionIds: readonly string[]
}

export interface FlowIntelligence {
  readonly engineVersion: 'fintrace-graph-v2'
  readonly riskScore: number
  readonly directCounterpartyCount: number
  readonly maxPathDepth: number
  readonly observedPathCount: number
  readonly cycleCount: number
  readonly velocityTransactionCount: number
  readonly observedFlowPaise: number
  readonly traceTruncated: boolean
  readonly paths: readonly FlowPath[]
  readonly signals: readonly IntelligenceSignal[]
}

export interface AiAnalysisContext {
  readonly focalAccountId: string
  readonly cutoffIso: string | null
  readonly score: number | null
  readonly priority: Priority | null
  readonly observedTransactionCount: number
  readonly evidenceTransactionIds: readonly string[]
  readonly signals: readonly Pick<SignalResult, 'id' | 'title' | 'status' | 'points' | 'explanation' | 'evidenceTransactionIds'>[]
  readonly graphIntelligence?: Pick<
    FlowIntelligence,
    'riskScore' | 'directCounterpartyCount' | 'maxPathDepth' | 'observedPathCount' | 'cycleCount' | 'velocityTransactionCount' | 'observedFlowPaise' | 'traceTruncated' | 'signals' | 'paths'
  >
  readonly relevantTransactions: readonly Transaction[]
  readonly sessionNote: string
}

export interface AiAnalysisObservation {
  readonly title: string
  readonly detail: string
  readonly evidenceTransactionIds: readonly string[]
}

export interface AiAnalysisResult {
  readonly provider: 'gemini'
  readonly model: string
  readonly generatedAt: string
  readonly headline: string
  readonly summary: string
  readonly answer: string
  readonly observations: readonly AiAnalysisObservation[]
  readonly reviewQuestions: readonly string[]
  readonly nextSteps: readonly string[]
  readonly caveats: readonly string[]
}

export interface AnalysisSnapshot {
  readonly asOfMs: number
  readonly visibleTransactions: readonly Transaction[]
  readonly visibleAccountIds: readonly string[]
  readonly cases: readonly AccountCase[]
}

export interface DetectorConfig {
  readonly collectionWindowMs: number
  readonly minDistinctSenders: number
  readonly forwardWindowMs: number
  readonly minOutflowPercent: number
  readonly reconvergeHopWindowMs: number
  readonly points: Readonly<Record<SignalId, number>>
  readonly detectorVersion: string
}

export interface ValidationIssue {
  readonly row?: number
  readonly field?: string
  readonly message: string
}

export interface ValidationResult {
  readonly ok: boolean
  readonly transactions: readonly Transaction[]
  readonly errors: readonly ValidationIssue[]
  readonly warnings: readonly string[]
  readonly inputRowCount: number
}

export interface GraphNodePosition {
  readonly x: number
  readonly y: number
}

export type GraphNodeKind = 'source' | 'focal' | 'branch' | 'recipient' | 'other'

export interface GraphNode {
  readonly id: string
  readonly label: string
  readonly kind: GraphNodeKind
  readonly position: GraphNodePosition
}

export interface GraphEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly transactionId: string
  readonly amountPaise: number
  readonly timestampMs: number
}

export interface GraphModel {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly truncated: boolean
  readonly totalCandidateEdges: number
  readonly totalCandidateNodes: number
}

export interface ExportMetadata {
  readonly sourceLabel: string
  readonly sourceKind: 'synthetic' | 'uploaded'
  readonly loadedTransactionCount: number
  readonly fileSizeBytes?: number
}

export interface CaseExport {
  readonly schemaVersion: 'fintrace-case-v1'
  readonly detectorVersion: string
  readonly generatedAt: string
  readonly source: {
    readonly label: string
    readonly kind: 'synthetic' | 'uploaded'
    readonly loadedTransactionCount: number
    readonly fileSizeBytes?: number
  }
  readonly selectedCutoff: string
  readonly displayTimezone: 'Asia/Kolkata'
  readonly ruleConfiguration: DetectorConfig
  readonly investigation: {
    readonly focalAccountId: string
    readonly representativeAnchor: string
    readonly score: 30 | 70 | 100
    readonly priority: Priority
    readonly signals: readonly SignalResult[]
    readonly supportingTransactions: readonly Transaction[]
    readonly graphIntelligence?: FlowIntelligence
    readonly warnings: readonly string[]
    readonly sessionNote: {
      readonly accountId: string
      readonly text: string
    }
  }
  readonly limitations: readonly string[]
}

export interface DatasetDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly transactions: readonly Transaction[]
  readonly sourceKind: 'synthetic'
  readonly scenarioNote?: string
}
