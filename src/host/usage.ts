/**
 * Session projection units carrying token usage per route.
 *
 * The fold mirrors `@deepseek-ai/dsh-token-meter`'s `tokenUsage` semantics
 * (final assistant settlement wins over stream samples, a retry closes the
 * replacement slot) but partitions the same buckets by route so the Client
 * can price each turn and each model with the local price table. No amount is
 * stored here: money is derived at render time.
 *
 * Two units share the fold:
 * - `modelsHelperUsage` keeps whole-session totals and is summary-visible, so
 *   every session-list row carries a small value the session header can
 *   aggregate across subagent Sessions.
 * - `modelsHelperTurns` keeps per-turn detail for the attached Session only
 *   (`summary: false`) and feeds `conversation.chat.turnTail`.
 *
 * Both register with `ctx.sessionProjections.register()` and publish a `wire`
 * value the Client reads with `useProjection(key)`.
 */
import type {
  UsageBuckets,
  UsageLastSample,
  UsageRouteRef,
  UsageRoutes,
  UsageTotalsProjection,
  UsageTurnsProjection,
} from '../shared/rpc.ts'
import { USAGE_TOTALS_KEY, USAGE_TURNS_KEY } from '../shared/rpc.ts'
import { bucketsEqual, emptyBuckets } from '../shared/cost.ts'
import { applyDelta, negateBuckets } from './usage-math.ts'
import type { SessionEvent, SessionProjectionDefinition } from './dsh.ts'

export function emptyUsageTotals(): UsageTotalsProjection {
  return { totals: {} }
}

export function emptyUsageTurns(): UsageTurnsProjection {
  return { turns: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Last `{type:'usage'}` chunk embedded in a durable assistant stream. */
function streamUsage(stream: unknown): UsageBuckets | undefined {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (!isRecord(record) || record.type !== 'chunk' || !isRecord(record.chunk)) continue
    if (record.chunk.type === 'usage') return bucketsOfUsage(record.chunk.usage)
  }
  return undefined
}

/** Normalize a provider-reported `TokenUsage` into billing buckets. */
function bucketsOfUsage(usage: unknown): UsageBuckets | undefined {
  if (!isRecord(usage)) return undefined
  const input = count(usage.inputTokens)
  const output = count(usage.outputTokens)
  if (input === undefined || output === undefined) return undefined
  return {
    input,
    output,
    cacheRead: count(usage.cacheReadTokens) ?? 0,
    cacheWrite: count(usage.cacheWriteTokens) ?? 0,
  }
}

/** Normalize a stored/checkpointed bucket object (`input`/`output` spelling). */
function persistedBuckets(value: unknown): UsageBuckets | undefined {
  if (!isRecord(value)) return undefined
  const input = count(value.input)
  const output = count(value.output)
  const cacheRead = count(value.cacheRead)
  const cacheWrite = count(value.cacheWrite)
  if (input === undefined || output === undefined || cacheRead === undefined || cacheWrite === undefined) return undefined
  return { input, output, cacheRead, cacheWrite }
}

function routeOf(value: unknown): UsageRouteRef | undefined {
  if (!isRecord(value)) return undefined
  const provider = value.provider
  const model = value.model
  return typeof provider === 'string' && provider.length > 0 && typeof model === 'string' && model.length > 0
    ? { provider, model }
    : undefined
}

function routeOfMessage(message: unknown): UsageRouteRef | undefined {
  return isRecord(message) ? routeOf(message.source) : undefined
}

interface Prepared<T> {
  state: T
  sample?: { last: UsageLastSample; route: UsageRouteRef }
}

/**
 * Apply the route/replacement bookkeeping every unit shares, and extract the
 * attempt sample an `assistant/message` or `assistant/attempt` carries.
 */
function prepare<T extends { last?: UsageLastSample; route?: UsageRouteRef }>(state: T, event: SessionEvent): Prepared<T> {
  if (event.type === 'llm/retry-started') {
    const data = isRecord(event.data) ? event.data : {}
    const last = state.last
    return last !== undefined && last.turn === data.turn && last.step === data.step
      ? { state: { ...state, last: undefined } }
      : { state }
  }
  if (event.type === 'request/context') {
    const route = routeOf(event.data)
    if (route === undefined) return { state }
    return state.route?.provider === route.provider && state.route.model === route.model
      ? { state }
      : { state: { ...state, route } }
  }
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return { state }

  const data = isRecord(event.data) ? event.data : {}
  const turn = count(data.turn)
  if (turn === undefined) return { state }
  const step = count(data.step) ?? 0
  const buckets = bucketsOfUsage(data.usage) ?? streamUsage(data.stream)
  if (buckets === undefined) return { state }
  // `assistant/message` carries the producing route; an attempt that committed
  // no message is attributed to the route of the last request.
  const route = (event.type === 'assistant/message' ? routeOfMessage(data.message) : undefined) ?? state.route
  const last: UsageLastSample = {
    turn,
    step,
    provider: route?.provider ?? 'unknown',
    model: route?.model ?? 'unknown',
    buckets,
  }
  return { state, sample: { last, route: route ?? { provider: last.provider, model: last.model } } }
}

/** Fold whole-session totals. */
export function foldUsageTotals(state: UsageTotalsProjection, event: SessionEvent): UsageTotalsProjection {
  const prepared = prepare(state, event)
  const before = prepared.state
  const sample = prepared.sample
  if (sample === undefined) return before
  const previous = before.last
  const sameSlot = previous !== undefined && previous.turn === sample.last.turn && previous.step === sample.last.step
  if (sameSlot && previous.provider === sample.last.provider && previous.model === sample.last.model
    && bucketsEqual(previous.buckets, sample.last.buckets)) {
    return state
  }
  let totals = before.totals
  if (sameSlot) totals = applyDelta(totals, previous.provider, previous.model, negateBuckets(previous.buckets))
  totals = applyDelta(totals, sample.last.provider, sample.last.model, sample.last.buckets)
  return { ...before, totals, last: sample.last, route: sample.route }
}

/** Fold per-turn detail. */
export function foldUsageTurns(state: UsageTurnsProjection, event: SessionEvent): UsageTurnsProjection {
  const prepared = prepare(state, event)
  const before = prepared.state
  const sample = prepared.sample
  if (sample === undefined) return before
  const previous = before.last
  const sameSlot = previous !== undefined && previous.turn === sample.last.turn && previous.step === sample.last.step
  if (sameSlot && previous.provider === sample.last.provider && previous.model === sample.last.model
    && bucketsEqual(previous.buckets, sample.last.buckets)) {
    return state
  }
  let turns = before.turns
  if (sameSlot) {
    turns = applyTurnDelta(turns, previous.turn, previous.provider, previous.model, negateBuckets(previous.buckets))
  }
  turns = applyTurnDelta(turns, sample.last.turn, sample.last.provider, sample.last.model, sample.last.buckets)
  return { ...before, turns, last: sample.last, route: sample.route }
}

/** Apply one signed bucket delta to `turn`'s route map. */
function applyTurnDelta(
  turns: Record<string, UsageRoutes>,
  turn: number,
  provider: string,
  model: string,
  delta: UsageBuckets,
): Record<string, UsageRoutes> {
  const key = String(turn)
  const next = applyDelta(turns[key] ?? {}, provider, model, delta)
  if (Object.keys(next).length === 0) {
    const { [key]: _removed, ...rest } = turns
    return rest
  }
  return { ...turns, [key]: next }
}

function sanitizeRoutes(value: unknown): UsageRoutes {
  if (!isRecord(value)) return {}
  const routes: UsageRoutes = {}
  for (const [provider, models] of Object.entries(value)) {
    if (provider.length === 0 || !isRecord(models)) continue
    const bucketMap: Record<string, UsageBuckets> = {}
    for (const [model, buckets] of Object.entries(models)) {
      if (model.length === 0) continue
      const normalized = persistedBuckets(buckets)
      if (normalized !== undefined) bucketMap[model] = normalized
    }
    if (Object.keys(bucketMap).length > 0) routes[provider] = bucketMap
  }
  return routes
}

function sanitizeLast(value: unknown): UsageLastSample | undefined {
  if (!isRecord(value)) return undefined
  const turn = count(value.turn)
  const step = count(value.step)
  const buckets = persistedBuckets(value.buckets)
  if (turn === undefined || step === undefined || buckets === undefined) return undefined
  if (typeof value.provider !== 'string' || typeof value.model !== 'string') return undefined
  return { turn, step, provider: value.provider, model: value.model, buckets }
}

function sanitizeCommon(
  value: Record<string, unknown>,
  state: { last?: UsageLastSample; route?: UsageRouteRef },
): void {
  const last = sanitizeLast(value.last)
  if (last !== undefined) state.last = last
  const route = routeOf(value.route)
  if (route !== undefined) state.route = route
}

/** Validate a persisted/checkpointed totals value. */
export function parseUsageTotals(value: unknown): UsageTotalsProjection {
  if (!isRecord(value)) throw new TypeError('models-helper: usage totals must be an object')
  const state: UsageTotalsProjection = { totals: sanitizeRoutes(value.totals) }
  sanitizeCommon(value, state)
  return state
}

/** Validate a persisted/checkpointed per-turn value. */
export function parseUsageTurns(value: unknown): UsageTurnsProjection {
  if (!isRecord(value)) throw new TypeError('models-helper: usage turns must be an object')
  const turns: Record<string, UsageRoutes> = {}
  if (isRecord(value.turns)) {
    for (const [turn, routes] of Object.entries(value.turns)) {
      if (!/^\d+$/.test(turn)) continue
      const sanitized = sanitizeRoutes(routes)
      if (Object.keys(sanitized).length > 0) turns[turn] = sanitized
    }
  }
  const state: UsageTurnsProjection = { turns }
  sanitizeCommon(value, state)
  return state
}

/**
 * Summary-visible totals unit. `view` returns the state itself so reference
 * reuse suppresses publication when nothing changed.
 */
export const usageTotalsProjection: SessionProjectionDefinition = {
  key: USAGE_TOTALS_KEY,
  stateVersion: 1,
  stateSchema: { parse: parseUsageTotals },
  init: () => emptyUsageTotals(),
  apply: foldUsageTotals,
  wire: {
    viewSchema: { parse: parseUsageTotals },
    view: state => state,
  },
}

/** Per-turn unit; kept out of session summaries. */
export const usageTurnsProjection: SessionProjectionDefinition = {
  key: USAGE_TURNS_KEY,
  stateVersion: 1,
  stateSchema: { parse: parseUsageTurns },
  init: () => emptyUsageTurns(),
  apply: foldUsageTurns,
  wire: {
    viewSchema: { parse: parseUsageTurns },
    view: state => state,
    summary: false,
  },
}

/** Re-exported for tests that build a value by hand. */
export { emptyBuckets }
