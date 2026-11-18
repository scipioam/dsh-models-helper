/**
 * Pure application step of a check-update diff: turn the user's selection into
 * the route's next `models` array. Kept out of the Host action so the merge of
 * add/update/remove rows is unit-testable without settings or network I/O.
 */
import type { ApplySelection, ModelFieldName, PlannedModel } from '../shared/rpc.ts'
import type { SelectionProblem } from '../shared/selection.ts'
import type { RawModel } from './domain.ts'
import { definedFields } from './domain.ts'
import { cloneJson } from './util.ts'

/** Fields an update row may write; locks and provenance already filtered them. */
export const APPLY_FIELDS: ReadonlySet<ModelFieldName> = new Set([
  'name',
  'contextWindow',
  'maxTokens',
  'input',
  'reasoningEfforts',
  'compat',
])

/**
 * Human-readable reason for a rejected selection. The wire code is
 * `models-helper/selection-invalid`; the Client localizes the code and this
 * message is mainly for logs and the Host-side tool error.
 */
export function selectionProblemMessage(problem: SelectionProblem): string {
  switch (problem.reason) {
    case 'invalid':
      return '应用选择无效'
    case 'unknown-model':
      return `差异中没有模型 "${problem.id}"`
    case 'wrong-mode':
      return `模型 "${problem.id}" 的操作类型与差异不一致`
    case 'field-not-in-diff':
      return `差异中没有模型 "${problem.id}" 的字段 "${problem.field}"`
    case 'empty-fields':
      return `模型 "${problem.id}" 没有选择要更新的字段`
  }
}

/**
 * Apply one diff selection to the current models.
 *
 * Additions append a desired model as-is, updates copy only the chosen fields
 * (deleting a field the desired model no longer has), and removals drop the
 * model. Unknown ids and empty field lists are ignored rather than failing the
 * whole apply; the caller rejects an application that would empty the route.
 */
export function applySelection(
  current: readonly RawModel[],
  desired: readonly PlannedModel[],
  selection: readonly ApplySelection[],
): RawModel[] {
  const desiredById = new Map(desired.map(model => [model.id, model]))
  const removed = new Set<string>()
  const additions: RawModel[] = []
  const updates: { id: string; fields: ModelFieldName[] }[] = []
  for (const item of selection) {
    if (typeof item.id !== 'string') continue
    if (item.mode === 'remove') { removed.add(item.id); continue }
    if (item.mode === 'add') {
      const plan = desiredById.get(item.id)
      if (plan !== undefined) additions.push({ id: plan.id, ...definedFields(plan.fields) } as RawModel)
      continue
    }
    const fields = Array.isArray(item.fields)
      ? item.fields.filter((field): field is ModelFieldName => APPLY_FIELDS.has(field as ModelFieldName))
      : []
    if (fields.length > 0) updates.push({ id: item.id, fields })
  }

  const models: RawModel[] = current.filter(model => !removed.has(model.id)).map(model => cloneJson(model))
  const byId = new Map(models.map(model => [model.id, model]))
  for (const addition of additions) {
    if (byId.has(addition.id)) continue
    models.push(addition)
    byId.set(addition.id, addition)
  }
  for (const update of updates) {
    const entry = byId.get(update.id)
    const plan = desiredById.get(update.id)
    if (entry === undefined || plan === undefined) continue
    for (const field of update.fields) {
      const value = plan.fields[field]
      if (value === undefined) delete entry[field]
      else (entry as Record<string, unknown>)[field] = value
    }
  }
  return models
}
