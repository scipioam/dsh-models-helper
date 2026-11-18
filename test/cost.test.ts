import { describe, expect, it } from 'vitest'
import {
  formatTokens,
  formatUsd,
  normalizePrice,
  promptTokens,
  ratesFor,
  usageCost,
} from '../src/shared/cost.ts'
import type { Price, UsageBuckets } from '../src/shared/rpc.ts'

const price = (overrides: Partial<Price> = {}): Price => ({ input: 3, output: 15, ...overrides })
const buckets = (overrides: Partial<UsageBuckets> = {}): UsageBuckets => ({
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, ...overrides,
})

describe('cost math', () => {
  it('prices each bucket at its own rate per million tokens', () => {
    const cost = usageCost(buckets({ input: 1_000_000, output: 2_000_000 }), price())
    expect(cost).toBe(3 + 30)
  })

  it('falls back to the input rate for missing cache rates', () => {
    const cost = usageCost(buckets({ cacheRead: 1_000_000, cacheWrite: 500_000 }), price())
    expect(cost).toBeCloseTo(3 + 1.5)
  })

  it('uses declared cache rates when present', () => {
    const cost = usageCost(buckets({ cacheRead: 1_000_000, cacheWrite: 1_000_000 }), price({ cacheRead: 0.3, cacheWrite: 3.75 }))
    expect(cost).toBeCloseTo(0.3 + 3.75)
  })

  it('selects the highest tier the prompt exceeds', () => {
    const tiered = price({
      tiers: [
        { inputTokensAbove: 200_000, input: 6, output: 22.5 },
        { inputTokensAbove: 100_000, input: 4, output: 20 },
      ],
    })
    expect(promptTokens(buckets({ input: 50_000, cacheRead: 20_000 }))).toBe(70_000)
    expect(ratesFor(tiered, buckets({ input: 70_000 })).input).toBe(3)
    expect(ratesFor(tiered, buckets({ input: 120_000 })).input).toBe(4)
    expect(ratesFor(tiered, buckets({ input: 250_000 })).output).toBe(22.5)
  })

  it('keeps the base rate at the threshold itself (strictly above)', () => {
    const tiered = price({ tiers: [{ inputTokensAbove: 200_000, input: 6, output: 22.5 }] })
    expect(ratesFor(tiered, buckets({ input: 200_000 })).input).toBe(3)
    expect(ratesFor(tiered, buckets({ input: 200_001 })).input).toBe(6)
  })

  it('counts cache traffic toward tier selection', () => {
    const tiered = price({ tiers: [{ inputTokensAbove: 200_000, input: 6, output: 22.5 }] })
    const bucketsAtTier = buckets({ input: 1_000, cacheRead: 200_000 })
    expect(ratesFor(tiered, bucketsAtTier).input).toBe(6)
  })

  it('falls cache rates back to the selected tier input', () => {
    const tiered = price({ tiers: [{ inputTokensAbove: 200_000, input: 6, output: 22.5 }] })
    const rates = ratesFor(tiered, buckets({ input: 300_000, cacheRead: 1 }))
    expect(rates.cacheRead).toBe(6)
    expect(rates.cacheWrite).toBe(6)
  })
})

describe('normalizePrice', () => {
  it('keeps valid fields and sorts tiers', () => {
    const normalized = normalizePrice({
      input: 1,
      output: 2,
      cacheRead: 0.1,
      tiers: [
        { inputTokensAbove: 200_000, input: 4, output: 8 },
        { inputTokensAbove: 100_000, input: 3, output: 7 },
      ],
    })
    expect(normalized).toEqual({
      input: 1,
      output: 2,
      cacheRead: 0.1,
      tiers: [
        { inputTokensAbove: 100_000, input: 3, output: 7 },
        { inputTokensAbove: 200_000, input: 4, output: 8 },
      ],
    })
  })

  it('rejects missing, negative, or non-finite base rates', () => {
    expect(normalizePrice(undefined)).toBeUndefined()
    expect(normalizePrice({ input: 1 })).toBeUndefined()
    expect(normalizePrice({ input: -1, output: 1 })).toBeUndefined()
    expect(normalizePrice({ input: Number.NaN, output: 1 })).toBeUndefined()
    expect(normalizePrice({ input: '1', output: 1 })).toBeUndefined()
  })

  it('drops malformed tiers instead of failing the price', () => {
    expect(normalizePrice({ input: 1, output: 1, tiers: [{ input: 2, output: 2 }, { inputTokensAbove: 1, input: 2, output: 2 }] }))
      .toEqual({ input: 1, output: 1, tiers: [{ inputTokensAbove: 1, input: 2, output: 2 }] })
  })
})

describe('formatting', () => {
  it('renders no price as an em dash, never zero', () => {
    expect(formatUsd(undefined)).toBe('—')
    expect(formatUsd(0)).toBe('$0')
    expect(formatUsd(0.00001)).toBe('<$0.0001')
    expect(formatUsd(0.0123)).toBe('$0.0123')
    expect(formatUsd(3.456)).toBe('$3.46')
  })

  it('compacts token counts', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(1_234)).toBe('1.2K')
    expect(formatTokens(1_234_567)).toBe('1.23M')
  })
})
