import { describe, expect, it } from 'vitest'
import type { PiAiModel } from '../src/host/pi-ai.ts'
import type { SourceModel } from '../src/host/sources.ts'
import {
  effortsFromSource,
  effortsFromThinkingLevelMap,
  mergePrice,
  offeredCompat,
  planGroup,
  routeCompatFor,
  sameSeries,
} from '../src/host/merge.ts'

function template(overrides: Partial<PiAiModel> & { id: string }): PiAiModel {
  return { api: 'anthropic-messages', provider: 'opencode-go', ...overrides }
}

function source(overrides: Partial<SourceModel> & { id: string }): SourceModel {
  return { api: 'anthropic-messages', baseURL: 'https://example.test', ...overrides }
}

describe('effortsFromThinkingLevelMap', () => {
  it('keeps explicit values and adds unsent off', () => {
    expect(effortsFromThinkingLevelMap({ off: null, low: 'low', medium: 'medium', high: 'high' }, 'anthropic-messages'))
      .toEqual({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' })
  })

  it('drops levels mapped to null except off', () => {
    expect(effortsFromThinkingLevelMap({ off: null, minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: null, max: null }, 'anthropic-messages'))
      .toEqual({ off: null, low: 'low', medium: 'medium', high: 'high' })
  })

  it('treats an empty map as every standard level by name', () => {
    expect(effortsFromThinkingLevelMap({}, 'openai-completions'))
      .toEqual({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' })
  })

  it('returns false when no non-off level remains', () => {
    expect(effortsFromThinkingLevelMap({ off: null, minimal: null, low: null, medium: null, high: null, xhigh: null, max: null }, 'anthropic-messages')).toBe(false)
  })

  it('enforces Gemini levels and values', () => {
    expect(effortsFromThinkingLevelMap({ off: null, minimal: 'minimal', low: 'different', high: 'high' }, 'google-generative-ai'))
      .toEqual({ off: null, minimal: 'minimal', medium: 'medium', high: 'high' })
  })
})

describe('effortsFromSource', () => {
  it('maps the none spelling and known level names', () => {
    expect(effortsFromSource({ supported: true, kind: 'effort', efforts: ['none', 'low', 'high', 'bogus'] }, 'anthropic-messages'))
      .toEqual({ value: { off: 'none', low: 'low', high: 'high' }, inferred: false })
  })

  it('infers a toggle as off/high', () => {
    expect(effortsFromSource({ supported: true, kind: 'toggle' }, 'openai-completions'))
      .toEqual({ value: { off: null, high: 'high' }, inferred: true })
  })

  it('infers budgets as three levels', () => {
    expect(effortsFromSource({ supported: true, kind: 'budget' }, 'anthropic-messages'))
      .toEqual({ value: { off: null, low: 'low', medium: 'medium', high: 'high' }, inferred: true })
  })

  it('passes through explicit non-reasoning', () => {
    expect(effortsFromSource({ supported: false }, 'anthropic-messages')).toEqual({ value: false, inferred: false })
  })

  it('drops unknown-only effort lists', () => {
    expect(effortsFromSource({ supported: true, kind: 'effort', efforts: ['bogus'] }, 'anthropic-messages'))
      .toEqual({ value: undefined, inferred: true })
  })
})

describe('compat gates', () => {
  it('keeps offered fields and drops withheld ones', () => {
    expect(offeredCompat({ supportsTemperature: false, openRouterRouting: { only: [] }, sessionAffinityFormat: 'x' }, 'anthropic-messages'))
      .toEqual({ supportsTemperature: false })
  })

  it('hoists only switches every template model sets identically', () => {
    const models = [
      template({ id: 'a', compat: { supportsTemperature: false, supportsStrictTools: true } }),
      template({ id: 'b', compat: { supportsTemperature: false, supportsStrictTools: false } }),
    ]
    expect(routeCompatFor(models, 'anthropic-messages')).toEqual({ supportsTemperature: false })
  })

  it('returns nothing for an empty group', () => {
    expect(routeCompatFor([], 'anthropic-messages')).toEqual({})
  })
})

describe('sameSeries', () => {
  it('prefers models.dev family matches', () => {
    const models = [template({ id: 'claude-haiku-5' }), template({ id: 'claude-opus-5' }), template({ id: 'gpt-5' })]
    expect(sameSeries('claude-sonnet-9', 'claude', models).map(model => model.id)).toEqual(['claude-haiku-5', 'claude-opus-5'])
  })

  it('falls back to the longest common id prefix', () => {
    const models = [template({ id: 'minimax-m2' }), template({ id: 'minimax-m3' }), template({ id: 'other' })]
    expect(sameSeries('minimax-m4', undefined, models).map(model => model.id)).toEqual(['minimax-m2', 'minimax-m3'])
  })

  it('returns nothing without a shared prefix', () => {
    expect(sameSeries('zzz-new', undefined, [template({ id: 'aaa-1' })])).toEqual([])
  })
})

describe('planGroup', () => {
  const templateModels = [
    template({
      id: 'claude-haiku-5',
      name: 'Claude Haiku 5',
      contextWindow: 200000,
      maxTokens: 64000,
      thinkingLevelMap: { off: null, low: 'low', medium: 'medium', high: 'high' },
      compat: { supportsTemperature: false, supportsMidConvoSystemMessages: true },
      cost: { input: 1, output: 5 },
    }),
    template({ id: 'legacy-model', name: 'Legacy', contextWindow: 100000, maxTokens: 8000 }),
  ]

  it('merges source over template and hoists route compat', () => {
    const sourceModels = [
      source({ id: 'claude-haiku-5', name: 'Claude Haiku 5.1', contextWindow: 220000, maxTokens: 64000, input: ['text', 'image'] }),
      source({ id: 'brand-new', name: 'Brand New', contextWindow: 128000, maxTokens: 16384, reasoning: { supported: true, kind: 'toggle' } }),
    ]
    const plan = planGroup({ api: 'anthropic-messages', sourceModels, templateModels })
    expect(plan.models.map(model => model.id)).toEqual(['claude-haiku-5', 'brand-new', 'legacy-model'])
    const haiku = plan.models[0]
    expect(haiku?.fields.name).toBe('Claude Haiku 5.1')
    expect(haiku?.fields.contextWindow).toBe(220000)
    expect(haiku?.provenance.contextWindow).toBe('source')
    expect(haiku?.fields.reasoningEfforts).toEqual({ off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' })
    // supportsTemperature is not set by every template model: stays on the model.
    expect(haiku?.fields.compat).toEqual({ supportsTemperature: false })
    expect(plan.routeCompat).toEqual({})
    expect(plan.templateOnly).toBe(1)
    expect(plan.noTemplate).toBe(1)
    expect(plan.withheldCompat).toBe(1)
  })

  it('marks inferred fields for models without a template', () => {
    const sourceModels = [source({ id: 'brand-new', contextWindow: 1000, reasoning: { supported: true, kind: 'toggle' } })]
    const plan = planGroup({ api: 'anthropic-messages', sourceModels, templateModels })
    const newModel = plan.models[0]
    expect(newModel?.inTemplate).toBe(false)
    expect(newModel?.fields.reasoningEfforts).toEqual({ off: null, high: 'high' })
    expect(newModel?.provenance.reasoningEfforts).toBe('inferred')
    // Same-series compat comes from the family/common-prefix candidates, if consistent.
    expect(newModel?.provenance.compat).toBeUndefined()
  })

  it('drops route-level compat from model entries', () => {
    const models = [
      template({ id: 'a-model', compat: { supportsStrictTools: true } }),
      template({ id: 'a-other', compat: { supportsStrictTools: true } }),
    ]
    const plan = planGroup({
      api: 'anthropic-messages',
      sourceModels: [source({ id: 'a-model' }), source({ id: 'a-other' })],
      templateModels: models,
    })
    expect(plan.routeCompat).toEqual({ supportsStrictTools: true })
    expect(plan.models[0]?.fields.compat).toBeUndefined()
  })
})

describe('mergePrice', () => {
  it('prefers the source price', () => {
    expect(mergePrice({ input: 1, output: 2 }, { input: 9, output: 9 })).toEqual({ input: 1, output: 2 })
  })

  it('falls back to the template price', () => {
    expect(mergePrice(undefined, { input: 9, output: 9 })).toEqual({ input: 9, output: 9 })
  })
})
