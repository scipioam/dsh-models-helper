import { describe, expect, it } from 'vitest'
import type { BindingDiff, DiffResult, HelperStatus } from '../src/shared/rpc.ts'
import { compactValue, countSelection, summaryOfCheck, summaryOfStatus } from '../src/host/tool-summary.ts'

function bindingDiff(route: string, overrides: Partial<BindingDiff> = {}): BindingDiff {
  return {
    route,
    source: { kind: 'models-dev', provider: 'openrouter' },
    template: 'openrouter',
    api: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    revision: 7,
    fetchedAt: '2026-11-18T00:00:00.000Z',
    online: true,
    added: [],
    candidates: [],
    updates: [],
    conflicts: [],
    removed: [],
    priceChanges: [],
    locked: [],
    ...overrides,
  }
}

function status(routes: number, bindings: number): HelperStatus {
  return {
    routes: Array.from({ length: routes }, (_, index) => ({
      id: `route-${index}`,
      displayName: `Route ${index}`,
      declared: true,
      apiKeyEnv: `ROUTE_${index}_API_KEY`,
      modelCount: 3,
      bound: index < bindings,
    })),
    bindings: Array.from({ length: bindings }, (_, index) => ({
      route: `route-${index}`,
      source: { kind: 'models-dev', provider: 'openrouter' },
      template: 'openrouter',
      api: 'openai-completions',
      baseURL: 'https://openrouter.ai/api/v1',
      autoIncludeNew: true,
      locked: ['m/name'],
    })),
    template: { version: '1.5.2', providers: ['openrouter', 'opencode-go'] },
    cache: {
      modelsDev: { fetchedAt: '2026-11-18T00:00:00.000Z', checkedAt: '2026-11-18T01:00:00.000Z' },
      openrouter: { staleReason: 'offline' },
    },
    llmRevision: 4,
  }
}

describe('summaryOfStatus', () => {
  it('omits credential references and summarizes counts', () => {
    const summary = summaryOfStatus(status(2, 1))
    expect(summary.template).toEqual({ version: '1.5.2', providerCount: 2 })
    expect(summary.cache.modelsDev.fetchedAt).toBe('2026-11-18T00:00:00.000Z')
    expect(summary.cache.openrouter.staleReason).toBe('offline')
    expect(summary.routes[0]).not.toHaveProperty('apiKeyEnv')
    expect(summary.routes[0]?.modelCount).toBe(3)
    expect(summary.bindings[0]?.lockedCount).toBe(1)
    expect(summary.llmRevision).toBe(4)
  })

  it('drops unconfigured catalog routes but keeps the default route', () => {
    const base = status(2, 0)
    base.routes.push({ id: 'empty-builtin', displayName: 'Empty', declared: false, modelCount: 0, bound: false })
    base.routes.push({ id: 'default-builtin', displayName: 'Default', declared: false, modelCount: 0, bound: false })
    base.defaultSelection = { provider: 'default-builtin', model: 'm' }
    const summary = summaryOfStatus(base)
    expect(summary.routes.map(route => route.id)).toEqual(['route-0', 'route-1', 'default-builtin'])
    expect(summary.routes.some(route => route.id === 'empty-builtin')).toBe(false)
  })

  it('caps routes and bindings and reports what was omitted', () => {
    const summary = summaryOfStatus(status(120, 120))
    expect(summary.routes).toHaveLength(100)
    expect(summary.bindings).toHaveLength(100)
    expect(summary.truncated).toEqual({ routes: 20, bindings: 20 })
  })
})

describe('summaryOfCheck', () => {
  it('keeps full group counts while bounding model rows', () => {
    const models = Array.from({ length: 30 }, (_, index) => ({
      id: `m-${index}`,
      kind: 'added' as const,
      defaultChecked: true,
      fields: [{ field: 'contextWindow' as const, new: 128000, provenance: 'source' as const }],
    }))
    const summary = summaryOfCheck({ results: [bindingDiff('custom', { added: models })] })
    const route = summary.results[0]
    expect(route?.counts.added).toBe(30)
    expect(route?.models).toHaveLength(20)
    expect(route?.truncated).toEqual({ models: 10 })
    expect(route?.suggestedSelection).toHaveLength(30)
  })

  it('omits an oversized suggested selection but keeps counts', () => {
    const models = Array.from({ length: 101 }, (_, index) => ({
      id: `m-${index}`,
      kind: 'added' as const,
      defaultChecked: true,
      fields: [],
    }))
    const route = summaryOfCheck({ results: [bindingDiff('custom', { added: models })] }).results[0]
    expect(route?.suggestedSelection).toBeUndefined()
    expect(route?.suggestedSelectionOmitted).toBe(true)
    expect(route?.counts.added).toBe(101)
  })

  it('bounds rows across routes', () => {
    const results: DiffResult = {
      results: Array.from({ length: 10 }, (_, routeIndex) => bindingDiff(`route-${routeIndex}`, {
        added: Array.from({ length: 20 }, (_, modelIndex) => ({
          id: `m-${routeIndex}-${modelIndex}`,
          kind: 'added' as const,
          defaultChecked: true,
          fields: [],
        })),
      })),
    }
    const summary = summaryOfCheck(results)
    expect(summary.results.reduce((total, route) => total + route.models.length, 0)).toBe(120)
    expect(summary.results[9]?.models).toHaveLength(0)
    expect(summary.results[9]?.truncated?.models).toBe(20)
  })

  it('compacts an oversized field value instead of dumping JSON', () => {
    const value = compactValue({ supportsTemperature: true, extra: 'x'.repeat(300) })
    expect(value.truncated).toBe(true)
    expect(value.value).toBeUndefined()
    expect(value.preview?.length).toBeLessThanOrEqual(140)
  })
})

describe('countSelection', () => {
  it('counts rows by mode and update fields', () => {
    expect(countSelection([
      { id: 'a', mode: 'add' },
      { id: 'b', mode: 'update', fields: ['name', 'maxTokens'] },
      { id: 'c', mode: 'remove' },
    ])).toEqual({ add: 1, update: 1, remove: 1, fields: 2 })
  })
})
