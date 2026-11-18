/**
 * Default checkbox state for one check-update diff. Kept pure and separate
 * from the panel so the regression that preselects candidates/removals (and
 * would silently delete models on Apply) is covered by a unit test.
 */
import type { BindingDiff, ModelDiff, ModelFieldName } from '../shared/rpc.ts'
import { gapFields } from '../shared/selection.ts'

export interface SelectionEntry {
  mode: 'add' | 'update' | 'remove'
  fields: Set<ModelFieldName>
}

function entryFor(mode: SelectionEntry['mode'], fields: readonly ModelFieldName[]): SelectionEntry {
  return { mode, fields: new Set(fields) }
}

/** The selection one row gets when the user checks it. */
export function entryForRow(row: ModelDiff): SelectionEntry {
  if (row.kind === 'added' || row.kind === 'candidate') return entryFor('add', [])
  if (row.kind === 'removed') return entryFor('remove', [])
  // Conflicts only fill fields the model does not set; hand-set values stay
  // unchecked unless the user explicitly checks that field (DESIGN §5).
  if (row.kind === 'conflict') return entryFor('update', gapFields(row))
  return entryFor('update', row.fields.map(field => field.field))
}

/** Initial selection: Host's `defaultChecked` decides; conflicts show gaps. */
export function defaultSelection(diff: BindingDiff): Map<string, SelectionEntry> {
  const map = new Map<string, SelectionEntry>()
  for (const row of [...diff.added, ...diff.candidates, ...diff.updates, ...diff.removed]) {
    if (row.defaultChecked) map.set(row.id, entryForRow(row))
  }
  for (const row of diff.conflicts) {
    const entry = entryForRow(row)
    if (entry.fields.size > 0) map.set(row.id, entry)
  }
  return map
}
