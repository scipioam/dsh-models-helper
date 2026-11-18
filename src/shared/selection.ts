/**
 * Pure selection rules shared by the diff panel, the footer's "apply defaults"
 * button and the Host agent tool. Keeping one implementation means the agent
 * and the UI always propose the same default rows, and `bindingApply` can
 * reject a selection that the visible diff never offered.
 */
import type { ApplySelection, ModelDiff, ModelFieldName } from './rpc.ts'

/** The five diff groups `computeDiff` produces (and `BindingDiff` carries). */
export interface DiffGroups {
  added: readonly ModelDiff[]
  candidates: readonly ModelDiff[]
  updates: readonly ModelDiff[]
  conflicts: readonly ModelDiff[]
  removed: readonly ModelDiff[]
}

function byId(rows: readonly ModelDiff[]): Map<string, ModelDiff> {
  return new Map(rows.map(row => [row.id, row]))
}

/**
 * Fields a conflict row may fill by default: the source has a value and the
 * model does not set that field at all. Values the model already sets stay
 * unchecked so a hand edit is never overwritten silently.
 */
export function gapFields(row: ModelDiff): ModelFieldName[] {
  return row.fields.filter(field => field.old === undefined).map(field => field.field)
}

/** Default rows for the footer's "apply defaults" action and the agent tool. */
export function defaultApplySelection(diff: DiffGroups): ApplySelection[] {
  const rows: ApplySelection[] = []
  for (const row of diff.added) rows.push({ id: row.id, mode: 'add' })
  for (const row of diff.updates) {
    const fields = row.fields.map(field => field.field)
    if (fields.length > 0) rows.push({ id: row.id, mode: 'update', fields })
  }
  for (const row of diff.conflicts) {
    const fields = gapFields(row)
    if (fields.length > 0) rows.push({ id: row.id, mode: 'update', fields })
  }
  return rows
}

/** Why a selection cannot be applied to the latest diff. */
export type SelectionProblem =
  | { reason: 'invalid' }
  | { reason: 'unknown-model'; id: string; mode: string }
  | { reason: 'wrong-mode'; id: string; mode: string }
  | { reason: 'field-not-in-diff'; id: string; field: string }
  | { reason: 'empty-fields'; id: string }

/**
 * Check that every selected row exists in the diff with a compatible mode and
 * that an update only names fields the diff listed. `applySelection` silently
 * ignores unknown rows; this guard keeps a stale or hand-built selection from
 * writing something the user never saw.
 */
export function selectionProblem(diff: DiffGroups, selection: readonly ApplySelection[]): SelectionProblem | undefined {
  const added = byId(diff.added)
  const candidates = byId(diff.candidates)
  const updates = byId(diff.updates)
  const conflicts = byId(diff.conflicts)
  const removed = byId(diff.removed)
  for (const item of selection) {
    if (typeof item.id !== 'string' || item.id.length === 0) return { reason: 'invalid' }
    if (item.mode === 'add') {
      if (added.has(item.id) || candidates.has(item.id)) continue
      if (updates.has(item.id) || conflicts.has(item.id)) return { reason: 'wrong-mode', id: item.id, mode: item.mode }
      return { reason: 'unknown-model', id: item.id, mode: item.mode }
    }
    if (item.mode === 'remove') {
      if (removed.has(item.id)) continue
      if (added.has(item.id) || candidates.has(item.id) || updates.has(item.id) || conflicts.has(item.id)) {
        return { reason: 'wrong-mode', id: item.id, mode: item.mode }
      }
      return { reason: 'unknown-model', id: item.id, mode: item.mode }
    }
    if (item.mode === 'update') {
      const row = updates.get(item.id) ?? conflicts.get(item.id)
      if (row === undefined) {
        if (added.has(item.id) || candidates.has(item.id)) return { reason: 'wrong-mode', id: item.id, mode: item.mode }
        return { reason: 'unknown-model', id: item.id, mode: item.mode }
      }
      const fields = Array.isArray(item.fields) ? item.fields : []
      if (fields.length === 0) return { reason: 'empty-fields', id: item.id }
      const allowed = new Set(row.fields.map(field => field.field))
      for (const field of fields) {
        if (!allowed.has(field)) return { reason: 'field-not-in-diff', id: item.id, field }
      }
      continue
    }
    return { reason: 'invalid' }
  }
  return undefined
}
