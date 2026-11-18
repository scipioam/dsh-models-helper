import { describe, expect, it } from 'vitest'
import type { BindingDiff, ModelDiff } from '../src/shared/rpc.ts'
import { defaultSelection, entryForRow } from '../src/client/diff-selection.ts'

function row(id: string, kind: ModelDiff['kind'], defaultChecked: boolean, fields: ModelDiff['fields'] = []): ModelDiff {
  return { id, kind, defaultChecked, fields }
}

function diff(overrides: Partial<BindingDiff> = {}): BindingDiff {
  return {
    route: 'custom',
    source: { kind: 'models-dev', provider: 'openrouter' },
    template: 'openrouter',
    api: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    revision: 1,
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

describe('defaultSelection', () => {
  it('respects defaultChecked instead of preselecting every group', () => {
    const selection = defaultSelection(diff({
      added: [row('new', 'added', true)],
      updates: [row('up', 'update', true, [
        { field: 'contextWindow', old: 1, new: 2, provenance: 'source' },
        { field: 'maxTokens', old: 3, new: 4, provenance: 'source' },
      ])],
      candidates: [row('candidate', 'candidate', false)],
      removed: [row('gone', 'removed', false)],
    }))
    expect([...selection.keys()].sort()).toEqual(['new', 'up'])
    expect(selection.get('up')?.fields).toEqual(new Set(['contextWindow', 'maxTokens']))
    expect(selection.has('candidate')).toBe(false)
    expect(selection.has('gone')).toBe(false)
  })

  it('checks only gap fields of a conflict and leaves hand-set values unchecked', () => {
    const selection = defaultSelection(diff({
      conflicts: [row('conflict', 'conflict', false, [
        { field: 'contextWindow', old: 1, new: 2, provenance: 'source' },
        { field: 'maxTokens', new: 9, provenance: 'source' },
      ])],
    }))
    expect(selection.get('conflict')?.mode).toBe('update')
    expect(selection.get('conflict')?.fields).toEqual(new Set(['maxTokens']))
  })

  it('preselects a removal only when the Host marks it checked', () => {
    const selection = defaultSelection(diff({ removed: [row('gone', 'removed', true)] }))
    expect(selection.get('gone')?.mode).toBe('remove')
  })
})

describe('entryForRow', () => {
  it('maps each row kind to its write mode', () => {
    expect(entryForRow(row('a', 'added', true)).mode).toBe('add')
    expect(entryForRow(row('b', 'candidate', false)).mode).toBe('add')
    expect(entryForRow(row('c', 'removed', false)).mode).toBe('remove')
    expect(entryForRow(row('d', 'update', true)).mode).toBe('update')
  })
})
