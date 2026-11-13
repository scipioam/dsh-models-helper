import { describe, expect, it } from 'vitest'
import type { PlannedModel } from '../src/shared/rpc.ts'
import type { ModelFields } from '../src/shared/rpc.ts'
import type { RawModel, RouteSnapshot } from '../src/host/domain.ts'
import { computeDiff } from '../src/host/diff.ts'

function planned(id: string, fields: PlannedModel['fields'] = {}): PlannedModel {
  return { id, inTemplate: true, templateOnly: false, fields, provenance: { contextWindow: 'source' } }
}

function current(id: string, fields: Omit<RawModel, 'id'> = {}): RawModel {
  return { id, ...fields }
}

function snapshot(models: Record<string, Partial<ModelFields>>): RouteSnapshot {
  return { at: '2026-11-13T00:00:00.000Z', models }
}

describe('computeDiff', () => {
  it('adds or candidates new source models by the autoIncludeNew switch', () => {
    const desired = [planned('new-model', { contextWindow: 1000 })]
    const on = computeDiff({ desired, current: [], snapshot: snapshot({}), locks: [], autoIncludeNew: true })
    expect(on.added.map(row => [row.id, row.defaultChecked])).toEqual([['new-model', true]])
    const off = computeDiff({ desired, current: [], snapshot: snapshot({}), locks: [], autoIncludeNew: false })
    expect(off.candidates.map(row => [row.id, row.defaultChecked])).toEqual([['new-model', false]])
  })

  it('reports field updates when the route still matches the snapshot', () => {
    const desired = [planned('m', { contextWindow: 2000 })]
    const result = computeDiff({
      desired,
      current: [current('m', { contextWindow: 1000 })],
      snapshot: snapshot({ m: { contextWindow: 1000 } }),
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0]?.defaultChecked).toBe(true)
    expect(result.updates[0]?.fields).toEqual([{ field: 'contextWindow', old: 1000, new: 2000, provenance: 'source' }])
    expect(result.conflicts).toHaveLength(0)
  })

  it('hides a hand edit while the source has not moved', () => {
    const result = computeDiff({
      desired: [planned('m', { contextWindow: 1000 })],
      current: [current('m', { contextWindow: 5000 })],
      snapshot: snapshot({ m: { contextWindow: 1000 } }),
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.updates).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('turns a hand edit into a conflict when the source moved too', () => {
    const result = computeDiff({
      desired: [planned('m', { contextWindow: 2000 })],
      current: [current('m', { contextWindow: 5000 })],
      snapshot: snapshot({ m: { contextWindow: 1000 } }),
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.defaultChecked).toBe(false)
    expect(result.conflicts[0]?.fields[0]).toMatchObject({ old: 5000, new: 2000 })
  })

  it('treats every difference as a conflict on first binding', () => {
    const result = computeDiff({
      desired: [planned('m', { contextWindow: 2000 })],
      current: [current('m', { contextWindow: 5000 })],
      snapshot: undefined,
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.conflicts).toHaveLength(1)
  })

  it('lists route models the source no longer has as removable', () => {
    const result = computeDiff({
      desired: [],
      current: [current('gone')],
      snapshot: snapshot({ gone: {} }),
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.removed.map(row => [row.id, row.defaultChecked])).toEqual([['gone', false]])
  })

  it('skips locked fields entirely', () => {
    const result = computeDiff({
      desired: [planned('m', { contextWindow: 2000 })],
      current: [current('m', { contextWindow: 1000 })],
      snapshot: snapshot({ m: { contextWindow: 1000 } }),
      locks: ['m/contextWindow'],
      autoIncludeNew: true,
    })
    expect(result.updates).toHaveLength(0)
  })

  it('reports only the fields that changed', () => {
    const desired = [planned('m', { contextWindow: 2000, name: 'New name', maxTokens: 100 })]
    const result = computeDiff({
      desired,
      current: [current('m', { contextWindow: 1000, name: 'New name', maxTokens: 100 })],
      snapshot: snapshot({ m: { contextWindow: 1000, name: 'New name', maxTokens: 100 } }),
      locks: [],
      autoIncludeNew: true,
    })
    expect(result.updates[0]?.fields.map(field => field.field)).toEqual(['contextWindow'])
  })
})
