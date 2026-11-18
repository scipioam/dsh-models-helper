import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/host/dsh.ts'
import {
  emptyUsageTotals,
  emptyUsageTurns,
  foldUsageTotals,
  foldUsageTurns,
  parseUsageTotals,
  parseUsageTurns,
  usageTotalsProjection,
  usageTurnsProjection,
} from '../src/host/usage.ts'
import { applyDelta } from '../src/host/usage-math.ts'
import type { UsageBuckets } from '../src/shared/rpc.ts'

const buckets = (overrides: Partial<UsageBuckets> = {}): UsageBuckets => ({
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, ...overrides,
})

function event(type: string, data: unknown): SessionEvent {
  return { type, data }
}

function messageEvent(turn: number, step: number, provider: string, model: string, usage: unknown): SessionEvent {
  return event('assistant/message', {
    turn,
    step,
    message: { role: 'assistant', source: { kind: 'model', provider, model } },
    stream: [],
    usage,
  })
}

function attemptEvent(turn: number, step: number, usage: unknown): SessionEvent {
  return event('assistant/attempt', {
    turn,
    step,
    stream: [{ type: 'chunk', time: 1, chunk: { type: 'usage', usage } }],
  })
}

describe('usage totals fold', () => {
  it('accumulates whole-session totals by route', () => {
    const state = foldUsageTotals(emptyUsageTotals(), messageEvent(1, 1, 'route-a', 'model-x', { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5 }))
    expect(state.totals).toEqual({ 'route-a': { 'model-x': { input: 100, output: 20, cacheRead: 5, cacheWrite: 0 } } })
    expect(state.last).toEqual({ turn: 1, step: 1, provider: 'route-a', model: 'model-x', buckets: buckets({ input: 100, output: 20, cacheRead: 5 }) })
  })

  it('falls back to the last stream usage chunk', () => {
    const message = event('assistant/message', {
      turn: 2,
      step: 1,
      message: { role: 'assistant', source: { provider: 'p', model: 'm' } },
      stream: [
        { type: 'text-chunks', time0: 0, index: 0, dt: [], texts: ['hi'] },
        { type: 'chunk', time: 1, chunk: { type: 'usage', usage: { inputTokens: 7, outputTokens: 3 } } },
      ],
    })
    const state = foldUsageTotals(emptyUsageTotals(), message)
    expect(state.totals['p']?.['m']).toEqual({ input: 7, output: 3, cacheRead: 0, cacheWrite: 0 })
  })

  it('attributes a stream-only attempt to the latest request route', () => {
    let state = foldUsageTotals(emptyUsageTotals(), event('request/context', { provider: 'route-b', model: 'model-y' }))
    state = foldUsageTotals(state, attemptEvent(1, 2, { inputTokens: 4, outputTokens: 2 }))
    expect(state.totals['route-b']?.['model-y']).toEqual({ input: 4, output: 2, cacheRead: 0, cacheWrite: 0 })
  })

  it('replaces a duplicate settlement for the same (turn, step)', () => {
    let state = foldUsageTotals(emptyUsageTotals(), messageEvent(1, 1, 'p', 'm', { inputTokens: 100, outputTokens: 10 }))
    state = foldUsageTotals(state, messageEvent(1, 1, 'p', 'm', { inputTokens: 200, outputTokens: 20 }))
    expect(state.totals['p']?.['m']).toEqual({ input: 200, output: 20, cacheRead: 0, cacheWrite: 0 })
  })

  it('closes the replacement slot on a retry and counts the retried attempt', () => {
    let state = foldUsageTotals(emptyUsageTotals(), messageEvent(1, 1, 'p', 'm', { inputTokens: 100, outputTokens: 10 }))
    state = foldUsageTotals(state, event('llm/retry-started', { turn: 1, step: 1 }))
    expect(state.last).toBeUndefined()
    expect(state.totals['p']?.['m']?.input).toBe(100)
    state = foldUsageTotals(state, attemptEvent(1, 1, { inputTokens: 50, outputTokens: 5 }))
    expect(state.totals['p']?.['m']).toEqual({ input: 150, output: 15, cacheRead: 0, cacheWrite: 0 })
  })

  it('returns the same reference for unrelated events', () => {
    const state = foldUsageTotals(emptyUsageTotals(), messageEvent(1, 1, 'p', 'm', { inputTokens: 1, outputTokens: 1 }))
    expect(foldUsageTotals(state, event('tool/call', { turn: 1, step: 1, callId: 'c', name: 'n', arguments: '{}' }))).toBe(state)
    expect(foldUsageTotals(state, event('request/header', { header: {} }))).toBe(state)
  })
})

describe('usage turns fold', () => {
  it('keeps earlier turns when later turns add usage', () => {
    let state = foldUsageTurns(emptyUsageTurns(), messageEvent(1, 1, 'p', 'm', { inputTokens: 1, outputTokens: 1 }))
    state = foldUsageTurns(state, messageEvent(2, 2, 'p', 'm', { inputTokens: 2, outputTokens: 2 }))
    expect(state.turns['1']?.['p']?.['m']?.input).toBe(1)
    expect(state.turns['2']?.['p']?.['m']?.input).toBe(2)
  })

  it('replaces within the same turn and drops emptied turns', () => {
    let state = foldUsageTurns(emptyUsageTurns(), messageEvent(1, 1, 'p', 'm', { inputTokens: 100, outputTokens: 10 }))
    state = foldUsageTurns(state, messageEvent(1, 1, 'p', 'm', { inputTokens: 40, outputTokens: 4 }))
    expect(state.turns['1']?.['p']?.['m']).toEqual({ input: 40, output: 4, cacheRead: 0, cacheWrite: 0 })
    const cleared = applyDelta({ p: { m: { input: 40, output: 4, cacheRead: 0, cacheWrite: 0 } } }, 'p', 'm', buckets({ input: -40, output: -4 }))
    expect(cleared).toEqual({})
  })

  it('updates the turn map and totals page independently', () => {
    const totals = foldUsageTotals(emptyUsageTotals(), messageEvent(1, 1, 'p', 'm', { inputTokens: 3, outputTokens: 1 }))
    const turns = foldUsageTurns(emptyUsageTurns(), messageEvent(1, 1, 'p', 'm', { inputTokens: 3, outputTokens: 1 }))
    expect(JSON.stringify(totals)).not.toContain('"turns"')
    expect(JSON.stringify(turns)).not.toContain('"totals"')
  })
})

describe('parsing persisted values', () => {
  it('round-trips totals', () => {
    const state = foldUsageTotals(emptyUsageTotals(), messageEvent(3, 1, 'p', 'm', { inputTokens: 1, outputTokens: 2 }))
    expect(parseUsageTotals(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  it('round-trips turns', () => {
    const state = foldUsageTurns(emptyUsageTurns(), messageEvent(3, 1, 'p', 'm', { inputTokens: 1, outputTokens: 2 }))
    expect(parseUsageTurns(JSON.parse(JSON.stringify(state)))).toEqual(state)
  })

  it('rejects a non-object checkpoint so the cache can discard it', () => {
    expect(() => parseUsageTotals('nope')).toThrow()
    expect(() => parseUsageTurns(null)).toThrow()
  })

  it('drops malformed buckets but keeps valid ones', () => {
    const parsed = parseUsageTurns({
      turns: { 1: { p: { bad: { input: -1, output: 1 } }, m: { good: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } } } },
    })
    expect(parsed.turns['1']).toEqual({ m: { good: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } } })
  })
})

describe('projection definitions', () => {
  it('registers totals as a summary key and turns as attached-only', () => {
    expect(usageTotalsProjection.key).toBe('modelsHelperUsage')
    expect(usageTotalsProjection.wire?.summary).toBeUndefined()
    expect(usageTurnsProjection.key).toBe('modelsHelperTurns')
    expect(usageTurnsProjection.wire?.summary).toBe(false)
    expect(usageTotalsProjection.init({}, 0)).toEqual({ totals: {} })
    expect(usageTurnsProjection.init({}, 0)).toEqual({ turns: {} })
  })
})
