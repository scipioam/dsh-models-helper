import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeHost } from './host-fixture.ts'
import { overrideFor, setPriceOverride } from '../src/host/prices.ts'
import { readPriceOverrides } from '../src/host/store.ts'
import type { Binding } from '../src/host/domain.ts'

async function host(): Promise<ReturnType<typeof makeHost>> {
  return makeHost({
    home: await mkdtemp(join(tmpdir(), 'dmh-prices-')),
    providers: { 'route-a': { models: [{ id: 'm1' }, { id: 'm2' }] } },
    declared: ['route-a'],
  })
}

describe('price overrides', () => {
  it('writes a nested override into the plugin Config and reads it back', async () => {
    const { ctx, state } = await host()
    const result = await setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: { input: 1.5, output: 2 } })
    expect(result.override).toEqual({ input: 1.5, output: 2 })
    expect(state.priceOverrides['route-a']?.['m1']).toEqual({ input: 1.5, output: 2 })
    expect(readPriceOverrides(ctx)['route-a']?.['m1']).toEqual({ input: 1.5, output: 2 })
  })

  it('normalizes fields and drops tiers that are malformed', async () => {
    const { ctx } = await host()
    await setPriceOverride(ctx, {
      route: 'route-a',
      model: 'm1',
      price: { input: 1, output: 2, cacheRead: 0.1, tiers: [{ inputTokensAbove: 100, input: 3, output: 4 }] } as never,
    })
    expect(readPriceOverrides(ctx)['route-a']?.['m1']).toEqual({
      input: 1,
      output: 2,
      cacheRead: 0.1,
      tiers: [{ inputTokensAbove: 100, input: 3, output: 4 }],
    })
  })

  it('clears an override and removes the emptied route entry', async () => {
    const { ctx, state } = await host()
    await setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: { input: 1, output: 2 } })
    await setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: null })
    expect(readPriceOverrides(ctx)).toEqual({})
    expect(state.priceOverrides['route-a']).toBeUndefined()
  })

  it('keeps sibling overrides when one is cleared', async () => {
    const { ctx, state } = await host()
    await setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: { input: 1, output: 2 } })
    await setPriceOverride(ctx, { route: 'route-a', model: 'm2', price: { input: 3, output: 4 } })
    await setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: null })
    expect(state.priceOverrides['route-a']).toEqual({ m2: { input: 3, output: 4 } })
  })

  it('rejects invalid prices and unknown routes', async () => {
    const { ctx } = await host()
    await expect(setPriceOverride(ctx, { route: 'route-a', model: 'm1', price: { input: -1, output: 1 } }))
      .rejects.toThrow(/价格无效/)
    await expect(setPriceOverride(ctx, { route: 'missing', model: 'm1', price: { input: 1, output: 1 } }))
      .rejects.toThrow(/没有供应商/)
  })
})

describe('resolution priority', () => {
  const legacy = {
    priceOverrides: { m1: { input: 9, output: 9 } },
  } as unknown as Binding

  it('prefers the plugin-wide override over the legacy binding field', () => {
    expect(overrideFor({ route: { m1: { input: 1, output: 2 } } }, legacy, 'route', 'm1')).toEqual({ input: 1, output: 2 })
  })

  it('falls back to the legacy binding field', () => {
    expect(overrideFor({}, legacy, 'route', 'm1')).toEqual({ input: 9, output: 9 })
  })

  it('returns undefined when neither has a valid price', () => {
    expect(overrideFor({}, legacy, 'route', 'm2')).toBeUndefined()
    expect(overrideFor({ route: { m1: { input: 'x' } } } as never, undefined, 'route', 'm1')).toBeUndefined()
  })
})
