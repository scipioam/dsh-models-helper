/**
 * Diff engine (pure): three-way comparison between the snapshot the plugin
 * wrote, the route's current user-layer models, and the freshly merged values.
 *
 * Hand edits (current ≠ snapshot while source stayed put) are hidden; when the
 * source moved too they become conflicts and are unchecked by default. A model
 * the snapshot knows but the route no longer lists was removed by the user, so
 * it is hidden rather than proposed again. A model with no snapshot was added
 * outside the plugin (e.g. discovered on the Models page): fields the model
 * does not set are gap-fill candidates, while values it already sets are
 * conflicts. Locked fields never take part.
 */
import type { FieldDiff, ModelDiff, ModelFieldName, PlannedModel } from '../shared/rpc.ts'
import type { RawModel } from './domain.ts'
import type { RouteSnapshot } from './domain.ts'
import { MODEL_FIELDS, modelFieldsOf } from './domain.ts'
import { deepEqual } from './util.ts'

export interface DiffInput {
  desired: readonly PlannedModel[]
  current: readonly RawModel[]
  snapshot: RouteSnapshot | undefined
  locks: readonly string[]
  autoIncludeNew: boolean
}

export interface ComputedDiff {
  added: ModelDiff[]
  candidates: ModelDiff[]
  updates: ModelDiff[]
  conflicts: ModelDiff[]
  removed: ModelDiff[]
}

function isLocked(locks: ReadonlySet<string>, model: string, field: ModelFieldName): boolean {
  return locks.has(`${model}/${field}`)
}

/** Present values of a desired model, in display order, for an "add" row. */
function addedFields(desired: PlannedModel): FieldDiff[] {
  const fields: FieldDiff[] = []
  for (const field of MODEL_FIELDS) {
    const next = desired.fields[field]
    if (next === undefined) continue
    fields.push({ field, new: next, provenance: desired.provenance[field] ?? 'source' })
  }
  return fields
}

/** Compare one model that exists on both sides. */
function updateFields(input: {
  desired: PlannedModel
  current: RawModel
  snapshotFields: Partial<Record<string, unknown>> | undefined
  hasSnapshot: boolean
  locks: ReadonlySet<string>
}): { fields: FieldDiff[]; conflicts: number } {
  const { desired, current, snapshotFields, hasSnapshot, locks } = input
  const currentFields = modelFieldsOf(current)
  const fields: FieldDiff[] = []
  let conflicts = 0
  for (const field of MODEL_FIELDS) {
    if (isLocked(locks, desired.id, field)) continue
    const old = currentFields[field]
    const next = desired.fields[field]
    if (deepEqual(old, next)) continue
    if (!hasSnapshot) {
      // First sighting: a field the model already sets is the user's value, so
      // a differing source value is a conflict until they confirm it. A field
      // it does not set is a gap the source can fill, and the panel selects
      // those by default.
      if (old !== undefined) conflicts += 1
      fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? 'source' })
      continue
    }
    const snap = snapshotFields?.[field]
    if (deepEqual(old, snap)) {
      fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? 'source' })
      continue
    }
    if (deepEqual(next, snap)) continue // hand edit, source unchanged: hidden
    conflicts += 1
    fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? 'source' })
  }
  return { fields, conflicts }
}

/** Compute the five groups of a check-update diff. */
export function computeDiff(input: DiffInput): ComputedDiff {
  const locks = new Set(input.locks)
  const currentById = new Map(input.current.map(model => [model.id, model]))
  const desiredIds = new Set(input.desired.map(model => model.id))
  const snapshotModels = input.snapshot?.models
  const diff: ComputedDiff = { added: [], candidates: [], updates: [], conflicts: [], removed: [] }

  for (const desired of input.desired) {
    const current = currentById.get(desired.id)
    if (current === undefined) {
      // The snapshot proves this model used to be on the route; its absence is
      // a deliberate removal, so do not propose re-adding it on every check.
      if (snapshotModels?.[desired.id] !== undefined) continue
      const checked = input.autoIncludeNew
      const row: ModelDiff = {
        id: desired.id,
        kind: checked ? 'added' : 'candidate',
        defaultChecked: checked,
        fields: addedFields(desired),
      }
      if (checked) diff.added.push(row)
      else diff.candidates.push(row)
      continue
    }
    const snapshotFields = snapshotModels?.[desired.id]
    const { fields, conflicts } = updateFields({
      desired,
      current,
      snapshotFields,
      hasSnapshot: snapshotFields !== undefined,
      locks,
    })
    if (fields.length === 0) continue
    if (conflicts > 0) {
      diff.conflicts.push({ id: desired.id, kind: 'conflict', defaultChecked: false, fields })
    } else {
      diff.updates.push({ id: desired.id, kind: 'update', defaultChecked: true, fields })
    }
  }

  for (const current of input.current) {
    if (desiredIds.has(current.id)) continue
    diff.removed.push({ id: current.id, kind: 'removed', defaultChecked: false, fields: [] })
  }
  return diff
}
