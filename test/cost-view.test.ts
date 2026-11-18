import { describe, expect, it } from 'vitest'
import { descendantRows, mergeRoutes, summarize, totalsValue, turnsValue } from '../src/client/cost-view.ts'
import type { PricesResult, UsageRoutes } from '../src/shared/rpc.ts'

function table(price: { input: number; output: number; cacheRead?: number; tiers?: { inputTokensAbove: number; input: number; output: number }[] } | undefined): PricesResult {
  return {
    routes: [{
      route: 'route-a',
      displayName: 'Route A',
      declared: true,
      bound: true,
      models: [{ id: 'model-x', source: price === undefined ? 'none' : 'snapshot', ...price === undefined ? {} : { price } }],
    }],
  }
}

const buckets = (input: number, output: number, cacheRead = 0): UsageRoutes => ({
  'route-a': { 'model-x': { input, output, cacheRead, cacheWrite: 0 } },
})

describe('summarize', () => {
  it('prices token buckets with the local table', () => {
    const summary = summarize(buckets(1_000_000, 1_000_000), table({ input: 3, output: 15 }))
    expect(summary.amount).toBeCloseTo(18)
    expect(summary.priced).toBe(1)
    expect(summary.missing).toBe(0)
    expect(summary.lines).toHaveLength(1)
  })

  it('counts unpriced routes as missing and excludes them from the amount', () => {
    const summary = summarize({ ...buckets(1_000_000, 0), 'route-b': { m: { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 } } }, table({ input: 3, output: 15 }))
    expect(summary.priced).toBe(1)
    expect(summary.missing).toBe(1)
    expect(summary.amount).toBeCloseTo(3)
  })

  it('selects the context tier from the aggregated prompt', () => {
    const summary = summarize(
      buckets(250_000, 1_000),
      table({ input: 3, output: 15, tiers: [{ inputTokensAbove: 200_000, input: 6, output: 22.5 }] }),
    )
    expect(summary.amount).toBeCloseTo((250_000 * 6 + 1_000 * 22.5) / 1_000_000)
  })

  it('renders no amount when nothing is priced', () => {
    const summary = summarize(buckets(100, 10), table(undefined))
    expect(summary.priced).toBe(0)
    expect(summary.missing).toBe(1)
    expect(summary.amount).toBe(0)
  })
})

describe('mergeRoutes', () => {
  it('sums buckets per provider/model without mutating inputs', () => {
    const left = buckets(1, 2)
    const right = buckets(10, 20, 3)
    const merged = mergeRoutes(left, right)
    expect(merged['route-a']?.['model-x']).toEqual({ input: 11, output: 22, cacheRead: 3, cacheWrite: 0 })
    expect(left['route-a']?.['model-x']?.input).toBe(1)
    expect(right['route-a']?.['model-x']?.input).toBe(10)
  })
})

describe('descendantRows', () => {
  const list = {
    byId: {
      root: { id: 'root' },
      a: { id: 'a', parentId: 'root' },
      b: { id: 'b', parentId: 'a' },
      other: { id: 'other' },
      childOfOther: { id: 'childOfOther', parentId: 'other' },
    },
  }

  it('walks parentId links below the root', () => {
    expect(descendantRows(list, 'root').map(row => row.id)).toEqual(['a', 'b'])
  })

  it('ignores unrelated sessions and the root itself', () => {
    expect(descendantRows(list, 'a').map(row => row.id)).toEqual(['b'])
    expect(descendantRows(list, undefined)).toEqual([])
    expect(descendantRows(undefined, 'root')).toEqual([])
  })
})

describe('projection narrowing', () => {
  it('accepts only the expected payload shapes', () => {
    expect(totalsValue({ totals: {} })).toEqual({ totals: {} })
    expect(totalsValue({ turns: {} })).toBeUndefined()
    expect(turnsValue({ turns: {} })).toEqual({ turns: {} })
    expect(turnsValue({ totals: {} })).toBeUndefined()
    expect(turnsValue(null)).toBeUndefined()
  })
})
