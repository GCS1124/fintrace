import { supabase } from '../lib/supabase'
import type { LoadedDataset } from '../hooks/useInvestigation'
import type { AccountCase, AnalysisSnapshot, FlowIntelligence } from '../types'

export interface SaveInvestigationInput {
  readonly ownerId: string
  readonly dataset: LoadedDataset
  readonly snapshot: AnalysisSnapshot
  readonly selectedAccountId: string
  readonly selectedCase: AccountCase
  readonly intelligence?: FlowIntelligence
  readonly sessionNote: string
}

export async function saveInvestigation(input: SaveInvestigationInput): Promise<string> {
  if (!supabase) throw new Error('Connect Supabase to save investigations to the private workspace.')
  if (input.ownerId === 'demo-analyst') throw new Error('Demo sessions are local only. Connect Supabase to save a case.')

  const payload = {
    dataset: {
      sourceLabel: input.dataset.sourceLabel,
      sourceKind: input.dataset.sourceKind,
      description: input.dataset.description,
      fileSizeBytes: input.dataset.fileSizeBytes ?? null,
      warnings: input.dataset.warnings,
      scenarioNote: input.dataset.scenarioNote ?? null,
      transactions: input.dataset.transactions,
    },
    snapshot: input.snapshot,
    intelligence: input.intelligence ?? null,
    sessionNote: input.sessionNote,
  }

  const { data, error } = await supabase
    .from('investigations')
    .insert({
      owner_id: input.ownerId,
      title: `${input.selectedAccountId} · ${input.dataset.sourceLabel}`,
      source_label: input.dataset.sourceLabel,
      source_kind: input.dataset.sourceKind,
      selected_account_id: input.selectedAccountId,
      cutoff_ms: Number.isFinite(input.snapshot.asOfMs) ? input.snapshot.asOfMs : null,
      score: input.selectedCase.score,
      payload,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

