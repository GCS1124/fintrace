import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import type cytoscapeTypes from 'cytoscape'
import { Focus, MousePointer2, X } from 'lucide-react'
import { formatRupees } from '../engine/money'
import { formatTime } from '../utils/format'
import type { GraphModel, GraphNode, Transaction } from '../types'
import styles from './InvestigationGraph.module.css'

interface InvestigationGraphProps {
  readonly model: GraphModel
  readonly selectedTransaction: Transaction | undefined
  readonly selectedNodeId: string | undefined
  readonly onSelectTransaction: (transactionId: string) => void
  readonly onSelectNode: (nodeId: string | undefined) => void
  readonly onFitView: () => void
}

function compactPositions(nodes: readonly GraphNode[], width: number, height: number): ReadonlyMap<string, { x: number; y: number }> {
  const counts: Record<GraphNode['kind'], number> = { source: 0, focal: 0, branch: 0, recipient: 0, other: 0 }
  const indexes: Record<GraphNode['kind'], number> = { source: 0, focal: 0, branch: 0, recipient: 0, other: 0 }
  nodes.forEach((node) => { counts[node.kind] += 1 })
  const columns: Record<GraphNode['kind'], number> = {
    source: Math.max(50, width * 0.16),
    focal: width * 0.42,
    branch: width * 0.68,
    recipient: Math.min(width - 48, width * 0.86),
    other: width * 0.52,
  }
  const sourceGap = counts.source > 1 ? Math.min(54, Math.max(38, (height - 56) / (counts.source - 1))) : 0
  const centerY = height / 2
  const positions = new Map<string, { x: number; y: number }>()

  nodes.forEach((node) => {
    const index = indexes[node.kind]
    indexes[node.kind] += 1
    const y = node.kind === 'source'
      ? 28 + index * sourceGap
      : centerY + (index - (counts[node.kind] - 1) / 2) * 54
    positions.set(node.id, { x: columns[node.kind], y })
  })
  return positions
}

export function InvestigationGraph({
  model,
  selectedTransaction,
  selectedNodeId,
  onSelectTransaction,
  onSelectNode,
  onFitView,
}: InvestigationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscapeTypes.Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (model.nodes.length === 0) {
      cyRef.current = null
      return
    }
    const compact = containerRef.current.clientWidth < 600
    const compactNodePositions = compact
      ? compactPositions(model.nodes, containerRef.current.clientWidth, containerRef.current.clientHeight)
      : undefined
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...model.nodes.map((node) => ({
          data: { id: node.id, label: node.label, kind: node.kind },
          position: compactNodePositions?.get(node.id) ?? node.position,
        })),
        ...model.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            transactionId: edge.transactionId,
            amountPaise: edge.amountPaise,
            timestampMs: edge.timestampMs,
          },
        })),
      ],
      layout: { name: 'preset', fit: false },
      minZoom: 0.25,
      maxZoom: 2,
      boxSelectionEnabled: false,
      autoungrabify: true,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': '#eef2f7',
            color: '#344054',
            'border-color': '#aebdce',
            'border-width': 1.5,
            'font-size': 12,
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 78,
            height: 36,
            shape: 'round-rectangle',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[kind = "source"]',
          style: { 'background-color': '#f4f6f9', 'border-color': '#b9c4d2' },
        },
        {
          selector: 'node[kind = "branch"]',
          style: { 'background-color': '#edf4ff', 'border-color': '#9db8ec' },
        },
        {
          selector: 'node[kind = "recipient"]',
          style: { 'background-color': '#f1f8f5', 'border-color': '#9bcbb3' },
        },
        {
          selector: 'node[kind = "focal"]',
          style: { 'background-color': '#2563eb', color: '#ffffff', 'border-color': '#1749bd', 'border-width': 2.5 },
        },
        {
          selector: 'edge',
          style: {
            width: 1.6,
            'line-color': '#aebbd0',
            'target-arrow-color': '#7e90aa',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.85,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'edge.is-related',
          style: { width: 2.8, 'line-color': '#2563eb', 'target-arrow-color': '#2563eb', opacity: 1 },
        },
        {
          selector: 'edge.is-selected',
          style: { width: 3.4, 'line-color': '#8a5700', 'target-arrow-color': '#8a5700', opacity: 1 },
        },
        {
          selector: 'node.is-selected',
          style: { 'border-color': '#8a5700', 'border-width': 3.5 },
        },
      ],
    })
    cyRef.current = cy
    cy.fit(undefined, 34)
    cy.on('tap', 'node', (event) => {
      const node = event.target
      cy.elements().removeClass('is-related')
      node.connectedEdges().addClass('is-related')
      onSelectNode(node.id())
    })
    cy.on('tap', 'edge', (event) => {
      onSelectNode(undefined)
      onSelectTransaction(String(event.target.data('transactionId')))
    })

    return () => {
      cy.removeAllListeners()
      cy.destroy()
      if (cyRef.current === cy) cyRef.current = null
    }
  }, [model, onSelectNode, onSelectTransaction])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('is-selected is-related')
    if (selectedTransaction) cy.getElementById(selectedTransaction.id).addClass('is-selected')
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId)
      node.addClass('is-selected')
      node.connectedEdges().addClass('is-related')
    }
  }, [selectedNodeId, selectedTransaction])

  const fitView = () => {
    cyRef.current?.fit(undefined, 34)
    onFitView()
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.graphToolbar}>
        <div className={styles.legend} aria-label="Graph legend">
          <span><i className={styles.legendFocal} /> Focal account</span>
          <span><i className={styles.legendBranch} /> Connected account</span>
        </div>
        <button type="button" className={styles.fitButton} onClick={fitView} disabled={model.nodes.length === 0}>
          <Focus size={14} aria-hidden="true" /> Fit view
        </button>
      </div>

      <div
        className={styles.canvas}
        role="img"
        aria-label={model.nodes.length > 0 ? 'Observed transaction relationship graph' : 'No observed transaction graph'}
      >
        <div ref={containerRef} className={styles.graphSurface} aria-hidden={model.nodes.length === 0} />
        {model.nodes.length === 0 ? (
          <div className={styles.emptyState}>
            <MousePointer2 size={20} aria-hidden="true" />
            <strong>No visible activity at this observation time</strong>
            <span>Move the timeline forward to reveal observed transfers.</span>
          </div>
        ) : null}
      </div>

      {model.truncated ? (
        <div className={styles.truncationNotice} role="status">
          Showing a subset ({model.edges.length} of {model.totalCandidateEdges} edges); all evidence remains in the table and export.
        </div>
      ) : null}

      {selectedTransaction ? (
        <div className={styles.edgeDetails} role="status">
          <div>
            <span className={styles.detailKicker}>Selected transfer</span>
            <strong>{selectedTransaction.fromAccount} <span>→</span> {selectedTransaction.toAccount}</strong>
          </div>
          <div className={styles.edgeMeta}>
            <span>{selectedTransaction.id}</span>
            <span>{formatTime(selectedTransaction.timestampMs)}</span>
            <strong>{formatRupees(selectedTransaction.amountPaise)}</strong>
          </div>
          <button type="button" className={styles.dismissButton} aria-label="Clear selected transfer" onClick={() => onSelectTransaction('')}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
