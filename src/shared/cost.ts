/**
 * Pure cost math shared by the Host (price normalization) and the Client
 * (estimates). Amounts are never persisted: a rendered estimate is always
 * `token buckets × local unit price`, so editing a price re-prices every
 * visible turn without touching the session log.
 */
import type { ModelPriceView, Price, PriceTier, PricesResult, UsageBuckets } from './rpc.ts'

export function emptyBuckets(): UsageBuckets {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

export function addBuckets(left: UsageBuckets, right: UsageBuckets): UsageBuckets {
  return {
    input: left.input + right.input,
    output: left.output + right.output,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
  }
}

export function subtractBuckets(left: UsageBuckets, right: UsageBuckets): UsageBuckets {
  return {
    input: left.input - right.input,
    output: left.output - right.output,
    cacheRead: left.cacheRead - right.cacheRead,
    cacheWrite: left.cacheWrite - right.cacheWrite,
  }
}

export function bucketsEqual(left: UsageBuckets, right: UsageBuckets): boolean {
  return left.input === right.input
    && left.output === right.output
    && left.cacheRead === right.cacheRead
    && left.cacheWrite === right.cacheWrite
}

export function bucketsEmpty(buckets: UsageBuckets): boolean {
  return buckets.input === 0 && buckets.output === 0 && buckets.cacheRead === 0 && buckets.cacheWrite === 0
}

/** Prompt-side tokens, the number that selects a context tier. */
export function promptTokens(buckets: UsageBuckets): number {
  return buckets.input + buckets.cacheRead + buckets.cacheWrite
}

export function totalTokens(buckets: UsageBuckets): number {
  return buckets.input + buckets.output + buckets.cacheRead + buckets.cacheWrite
}

/**
 * Unit rates that apply to one prompt size: the highest tier whose threshold
 * the prompt exceeds, else the base price. Tiers may omit cache rates; those
 * fall back to the same tier's input rate (the base's cache rate when the
 * base declares one), matching DESIGN §7.
 */
export function ratesFor(price: Price, buckets: UsageBuckets): Required<Pick<Price, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>> {
  const prompt = promptTokens(buckets)
  let tier: PriceTier | undefined
  for (const candidate of price.tiers ?? []) {
    if (prompt > candidate.inputTokensAbove && (tier === undefined || candidate.inputTokensAbove > tier.inputTokensAbove)) {
      tier = candidate
    }
  }
  const input = tier?.input ?? price.input
  const cacheRead = tier?.cacheRead ?? price.cacheRead ?? input
  const cacheWrite = tier?.cacheWrite ?? price.cacheWrite ?? input
  return { input, output: tier?.output ?? price.output, cacheRead, cacheWrite }
}

/**
 * Estimated cost in USD of one usage block at one unit price.
 * @param buckets - token counts of the call(s).
 * @param price - USD per 1M tokens; tiers selected by prompt size.
 * @returns cost in USD (never rounded here).
 */
export function usageCost(buckets: UsageBuckets, price: Price): number {
  const rates = ratesFor(price, buckets)
  return (
    buckets.input * rates.input
    + buckets.output * rates.output
    + buckets.cacheRead * rates.cacheRead
    + buckets.cacheWrite * rates.cacheWrite
  ) / 1_000_000
}

/**
 * Normalize a JSON value into a `Price`, or return undefined when it is not
 * one. Used for plugin Config reads and for the override RPC boundary.
 */
export function normalizePrice(value: unknown): Price | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const input = nonNegative(raw.input)
  const output = nonNegative(raw.output)
  if (input === undefined || output === undefined) return undefined
  const price: Price = { input, output }
  const cacheRead = nonNegative(raw.cacheRead)
  const cacheWrite = nonNegative(raw.cacheWrite)
  if (cacheRead !== undefined) price.cacheRead = cacheRead
  if (cacheWrite !== undefined) price.cacheWrite = cacheWrite
  const tiers = normalizeTiers(raw.tiers)
  if (tiers !== undefined && tiers.length > 0) price.tiers = tiers
  return price
}

function normalizeTiers(value: unknown): PriceTier[] | undefined {
  if (!Array.isArray(value)) return undefined
  const tiers: PriceTier[] = []
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    const inputTokensAbove = nonNegative(raw.inputTokensAbove)
    const input = nonNegative(raw.input)
    const output = nonNegative(raw.output)
    if (inputTokensAbove === undefined || input === undefined || output === undefined) continue
    const tier: PriceTier = { inputTokensAbove, input, output }
    const cacheRead = nonNegative(raw.cacheRead)
    const cacheWrite = nonNegative(raw.cacheWrite)
    if (cacheRead !== undefined) tier.cacheRead = cacheRead
    if (cacheWrite !== undefined) tier.cacheWrite = cacheWrite
    tiers.push(tier)
  }
  return tiers.sort((left, right) => left.inputTokensAbove - right.inputTokensAbove)
}

function nonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Display an estimate. `undefined` (no price at all) renders `—`, never `$0`.
 * @param value - USD amount.
 */
export function formatUsd(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0'
  if (value < 0.0001) return '<$0.0001'
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

/** Look one model's resolved price up in a price-table snapshot. */
export function findModelPrice(table: PricesResult | undefined, provider: string, model: string): ModelPriceView | undefined {
  if (table === undefined) return undefined
  const route = table.routes.find(row => row.route === provider)
  return route?.models.find(row => row.id === model)
}

/** Compact token count for tooltips: 1234 → 1.2K, 1234567 → 1.23M. */
export function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`
  return `${(value / 1_000_000).toFixed(2)}M`
}
