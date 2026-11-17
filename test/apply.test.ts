import { describe, expect, it } from 'vitest'
import type { PlannedModel } from '../src/shared/rpc.ts'
import type { RawModel } from '../src/host/domain.ts'
import { applySelection } from '../src/host/apply.ts'

function planned(id: string, fields: PlannedModel['fields'] = {}): PlannedModel {
  return { id, inTemplate: true, templateOnly: false, fields, provenance: {} }
}

describe('applySelection', () => {
  it('adds a desired model with exactly the planned fields', () => {
    const plannedModel = planned('new', { name: 'New', contextWindow: 1000, compat: { supportsTemperature: false } })
    const models = applySelection([], [plannedModel], [{ id: 'new', mode: 'add' }])
    expect(models).toEqual([{ id: 'new', name: 'New', contextWindow: 1000, compat: { supportsTemperature: false } }])
  })

  it('does not add the same model twice', () => {
    const current: RawModel[] = [{ id: 'm', contextWindow: 1 }]
    const models = applySelection(current, [planned('m', { contextWindow: 2000 })], [{ id: 'm', mode: 'add' }])
    expect(models).toEqual([{ id: 'm', contextWindow: 1 }])
  })

  it('writes only the chosen fields and deletes a field the plan dropped', () => {
    const current: RawModel[] = [{ id: 'm', contextWindow: 1000, maxTokens: 200, name: 'old' }]
    const models = applySelection(
      current,
      [planned('m', { contextWindow: 2000 })],
      [{ id: 'm', mode: 'update', fields: ['contextWindow', 'name'] }],
    )
    expect(models).toEqual([{ id: 'm', contextWindow: 2000, maxTokens: 200 }])
  })

  it('removes selected models and keeps the rest', () => {
    const models = applySelection(
      [{ id: 'a' }, { id: 'b' }],
      [planned('a'), planned('b')],
      [{ id: 'a', mode: 'remove' }],
    )
    expect(models).toEqual([{ id: 'b' }])
  })

  it('ignores unknown ids, empty field lists and unsupported modes gracefully', () => {
    const models = applySelection(
      [{ id: 'a' }],
      [planned('a')],
      [
        { id: 'unknown', mode: 'remove' },
        { id: 'a', mode: 'update', fields: [] },
        { id: 'a', mode: 'add' },
      ],
    )
    expect(models).toEqual([{ id: 'a' }])
  })

  it('does not mutate the input models', () => {
    const current: RawModel[] = [{ id: 'm', contextWindow: 1000 }]
    applySelection(current, [planned('m', { contextWindow: 2000 })], [{ id: 'm', mode: 'update', fields: ['contextWindow'] }])
    expect(current[0]?.contextWindow).toBe(1000)
  })
})
