/**
 * Signed bucket arithmetic over the nested route map used by the usage
 * projection. Kept out of `usage.ts` so the fold reads as event handling and
 * this stays trivially testable.
 */
import type { UsageBuckets, UsageRoutes } from '../shared/rpc.ts'
import { emptyBuckets } from '../shared/cost.ts'

export function negateBuckets(buckets: UsageBuckets): UsageBuckets {
  return {
    input: -buckets.input,
    output: -buckets.output,
    cacheRead: -buckets.cacheRead,
    cacheWrite: -buckets.cacheWrite,
  }
}

/**
 * Add a signed delta for one `(provider, model)` pair, dropping entries that
 * reach all zeros so an emptied turn disappears instead of lingering.
 */
export function applyDelta(routes: UsageRoutes, provider: string, model: string, delta: UsageBuckets): UsageRoutes {
  const models = routes[provider] ?? {}
  const current = models[model] ?? emptyBuckets()
  const next: UsageBuckets = {
    input: current.input + delta.input,
    output: current.output + delta.output,
    cacheRead: current.cacheRead + delta.cacheRead,
    cacheWrite: current.cacheWrite + delta.cacheWrite,
  }
  if (next.input === 0 && next.output === 0 && next.cacheRead === 0 && next.cacheWrite === 0) {
    const { [model]: _droppedModel, ...remainingModels } = models
    if (Object.keys(remainingModels).length === 0) {
      const { [provider]: _droppedProvider, ...remainingProviders } = routes
      return remainingProviders
    }
    return { ...routes, [provider]: remainingModels }
  }
  return { ...routes, [provider]: { ...models, [model]: next } }
}
