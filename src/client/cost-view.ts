/**
 * Pure view-model helpers for the conversation cost displays. Kept out of
 * `Cost.tsx` so the pricing and subagent aggregation can be unit-tested
 * without React or a live slot.
 */
import type {
  ModelPriceView,
  PricesResult,
  UsageBuckets,
  UsageRoutes,
  UsageTotalsProjection,
  UsageTurnsProjection,
} from '../shared/rpc.ts'
import { addBuckets, emptyBuckets, findModelPrice, usageCost } from '../shared/cost.ts'

export interface CostLine {
  provider: string
  model: string
  buckets: UsageBuckets
  amount?: number
  price?: ModelPriceView
}

export interface CostSummary {
  amount: number
  /** Routes with a local price. */
  priced: number
  /** Routes without a local price (rendered as `—` / `*`). */
  missing: number
  lines: CostLine[]
}

export interface SessionRowLike {
  id: string
  parentId?: string
  projectionValues?: Record<string, unknown>
}

export interface SessionListLike {
  byId: Record<string, SessionRowLike>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Narrow a projection value to the summary totals payload. */
export function totalsValue(value: unknown): UsageTotalsProjection | undefined {
  if (!isRecord(value) || !isRecord(value.totals)) return undefined
  return value as unknown as UsageTotalsProjection
}

/** Narrow a projection value to the per-turn payload. */
export function turnsValue(value: unknown): UsageTurnsProjection | undefined {
  if (!isRecord(value) || !isRecord(value.turns)) return undefined
  return value as unknown as UsageTurnsProjection
}

/** Price one route map with the current local price table. */
export function summarize(routes: UsageRoutes, table: PricesResult | undefined): CostSummary {
  const lines: CostLine[] = []
  let amount = 0
  let priced = 0
  let missing = 0
  for (const [provider, models] of Object.entries(routes)) {
    for (const [model, buckets] of Object.entries(models)) {
      const price = findModelPrice(table, provider, model)
      const cost = price?.price === undefined ? undefined : usageCost(buckets, price.price)
      if (cost === undefined) missing += 1
      else {
        amount += cost
        priced += 1
      }
      lines.push({ provider, model, buckets, ...cost === undefined ? {} : { amount: cost }, ...price === undefined ? {} : { price } })
    }
  }
  lines.sort((left, right) => (right.amount ?? -1) - (left.amount ?? -1))
  return { amount, priced, missing, lines }
}

/** Add one route map into another without mutating either. */
export function mergeRoutes(target: UsageRoutes, source: UsageRoutes): UsageRoutes {
  const next: UsageRoutes = { ...target }
  for (const [provider, models] of Object.entries(source)) {
    const providerRoutes = { ...next[provider] }
    for (const [model, buckets] of Object.entries(models)) {
      providerRoutes[model] = addBuckets(providerRoutes[model] ?? emptyBuckets(), buckets)
    }
    next[provider] = providerRoutes
  }
  return next
}

/**
 * Rows of subagent Sessions whose `parentId` chain reaches `root`.
 * Breadth-first with a visited set so a duplicated parent link cannot loop.
 */
export function descendantRows(list: SessionListLike | undefined, root: string | undefined): SessionRowLike[] {
  if (list === undefined || root === undefined) return []
  const byParent = new Map<string, SessionRowLike[]>()
  for (const row of Object.values(list.byId)) {
    if (row.parentId === undefined || row.id === root) continue
    const bucket = byParent.get(row.parentId) ?? []
    bucket.push(row)
    byParent.set(row.parentId, bucket)
  }
  const out: SessionRowLike[] = []
  const queue = [root]
  const seen = new Set(queue)
  while (queue.length > 0) {
    const parent = queue.shift() as string
    for (const child of byParent.get(parent) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      out.push(child)
      queue.push(child.id)
    }
  }
  return out
}
