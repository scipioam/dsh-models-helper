import { describe, expect, it } from 'vitest'
import type { BindingDiff, ModelDiff } from '../src/shared/rpc.ts'
import { defaultApplySelection, gapFields, selectionProblem } from '../src/shared/selection.ts'

function row(id: string, kind: ModelDiff['kind'], fields: ModelDiff['fields'] = []): ModelDiff {
  return { id, kind, defaultChecked: kind === 'update' || kind === 'added', fields }
}

function diff(overrides: Partial<BindingDiff> = {}): BindingDiff {
  return {
    route: 'custom',
    source: { kind: 'models-dev', provider: 'openrouter' },
    template: 'openrouter',
    api: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    revision: 3,
    fetchedAt: '2026-11-18T00:00:00.000Z',
    online: true,
    added: [],
    candidates: [],
    updates: [],
    conflicts: [],
    removed: [],
    priceChanges: [],
    locked: [],
    ...overrides,
  }
}

describe('defaultApplySelection', () => {
  it('adds added models, takes all update fields and only gap fields of conflicts', () => {
    const selection = defaultApplySelection(diff({
      added: [row('new', 'added', [{ field: 'contextWindow', new: 1000, provenance: 'source' }])],
      updates: [row('up', 'update', [
        { field: 'contextWindow', old: 1, new: 2, provenance: 'source' },
        { field: 'maxTokens', old: 3, new: 4, provenance: 'source' },
      ])],
      conflicts: [row('conflict', 'conflict', [
        { field: 'contextWindow', old: 1, new: 2, provenance: 'source' },
        { field: 'maxTokens', new: 9, provenance: 'source' },
      ])],
      candidates: [row('candidate', 'candidate')],
      removed: [row('gone', 'removed')],
    }))
    expect(selection).toEqual([
      { id: 'new', mode: 'add' },
      { id: 'up', mode: 'update', fields: ['contextWindow', 'maxTokens'] },
      { id: 'conflict', mode: 'update', fields: ['maxTokens'] },
    ])
  })

  it('leaves candidates and removals unchecked', () => {
    const selection = defaultApplySelection(diff({
      candidates: [row('candidate', 'candidate')],
      removed: [row('gone', 'removed')],
    }))
    expect(selection).toEqual([])
  })

  it('gapFields only returns fields the model does not set', () => {
    const conflict = row('m', 'conflict', [
      { field: 'name', old: 'Old', new: 'New', provenance: 'source' },
      { field: 'maxTokens', new: 10, provenance: 'source' },
    ])
    expect(gapFields(conflict)).toEqual(['maxTokens'])
  })
})

describe('selectionProblem', () => {
  const base = diff({
    added: [row('new', 'added')],
    candidates: [row('candidate', 'candidate')],
    updates: [row('up', 'update', [
      { field: 'contextWindow', old: 1, new: 2, provenance: 'source' },
      { field: 'maxTokens', old: 3, new: 4, provenance: 'source' },
    ])],
    conflicts: [row('conflict', 'conflict', [{ field: 'name', new: 'New', provenance: 'source' }])],
    removed: [row('gone', 'removed')],
  })

  it('accepts rows and fields present in the diff', () => {
    expect(selectionProblem(base, [
      { id: 'new', mode: 'add' },
      { id: 'candidate', mode: 'add' },
      { id: 'up', mode: 'update', fields: ['contextWindow'] },
      { id: 'conflict', mode: 'update', fields: ['name'] },
      { id: 'gone', mode: 'remove' },
    ])).toBeUndefined()
  })

  it('rejects a model that is not in the diff', () => {
    expect(selectionProblem(base, [{ id: 'missing', mode: 'add' }])).toEqual({ reason: 'unknown-model', id: 'missing', mode: 'add' })
  })

  it('rejects a mode that does not match the row', () => {
    expect(selectionProblem(base, [{ id: 'up', mode: 'add' }])).toEqual({ reason: 'wrong-mode', id: 'up', mode: 'add' })
    expect(selectionProblem(base, [{ id: 'new', mode: 'update', fields: ['name'] }])).toEqual({ reason: 'wrong-mode', id: 'new', mode: 'update' })
  })

  it('rejects a field the diff did not list', () => {
    expect(selectionProblem(base, [{ id: 'up', mode: 'update', fields: ['name'] }])).toEqual({ reason: 'field-not-in-diff', id: 'up', field: 'name' })
  })

  it('rejects an update with no fields', () => {
    expect(selectionProblem(base, [{ id: 'up', mode: 'update', fields: [] }])).toEqual({ reason: 'empty-fields', id: 'up' })
  })
})
