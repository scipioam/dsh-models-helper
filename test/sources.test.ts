import { describe, expect, it } from 'vitest'
import { normalizeBaseURL, normalizeModelsDevProvider, normalizeOpenRouter, protocolOfNpm } from '../src/host/sources.ts'

describe('protocolOfNpm', () => {
  it('maps the AI SDK adapters pi-ai can serve', () => {
    expect(protocolOfNpm('@ai-sdk/openai-compatible')).toBe('openai-completions')
    expect(protocolOfNpm('@ai-sdk/openai')).toBe('openai-responses')
    expect(protocolOfNpm('@ai-sdk/anthropic')).toBe('anthropic-messages')
    expect(protocolOfNpm('@ai-sdk/google')).toBe('google-generative-ai')
    expect(protocolOfNpm('@openrouter/ai-sdk-provider')).toBe('openai-completions')
  })

  it('leaves unknown adapters unmapped', () => {
    expect(protocolOfNpm('@ai-sdk/amazon-bedrock')).toBeUndefined()
    expect(protocolOfNpm(undefined)).toBeUndefined()
  })
})

describe('normalizeBaseURL', () => {
  it('drops a trailing /v1 only for Anthropic Messages', () => {
    expect(normalizeBaseURL('anthropic-messages', 'https://gw.example/anthropic/v1/')).toBe('https://gw.example/anthropic')
    expect(normalizeBaseURL('openai-completions', 'https://gw.example/openai/v1/')).toBe('https://gw.example/openai/v1')
  })
})

describe('normalizeModelsDevProvider', () => {
  const provider = {
    id: 'gw',
    npm: '@ai-sdk/openai-compatible',
    api: 'https://gw.example/v1',
    models: {
      'chat-a': {
        id: 'chat-a',
        name: 'Chat A',
        family: 'chat',
        reasoning: true,
        reasoning_options: [{ type: 'effort', values: ['none', 'low', 'high'] }],
        modalities: { input: ['text', 'image', 'pdf'] },
        limit: { context: 200000, output: 32000 },
        cost: { input: 1, output: 4, cache_read: 0.1, tiers: [{ input: 2, output: 8, tier: { type: 'context', size: 128000 } }] },
        tool_call: true,
      },
      'claude-b': {
        id: 'claude-b',
        provider: { npm: '@ai-sdk/anthropic', api: 'https://gw.example/anthropic/v1' },
        reasoning: false,
        tool_call: true,
      },
      'embed-c': { id: 'embed-c', type: 'embedding', tool_call: false },
    },
  }

  it('normalizes capacities, modalities, reasoning and prices', () => {
    const [chat] = normalizeModelsDevProvider(provider)
    expect(chat).toEqual({
      id: 'chat-a',
      name: 'Chat A',
      family: 'chat',
      api: 'openai-completions',
      baseURL: 'https://gw.example/v1',
      contextWindow: 200000,
      maxTokens: 32000,
      input: ['text', 'image'],
      reasoning: { supported: true, kind: 'effort', efforts: ['none', 'low', 'high'] },
      cost: { input: 1, output: 4, cacheRead: 0.1, tiers: [{ inputTokensAbove: 128000, input: 2, output: 8 }] },
    })
  })

  it('applies per-model protocol overrides and skips non-chat models', () => {
    const models = normalizeModelsDevProvider(provider)
    expect(models.map(model => model.id)).toEqual(['chat-a', 'claude-b'])
    expect(models[1]).toMatchObject({ api: 'anthropic-messages', baseURL: 'https://gw.example/anthropic', reasoning: { supported: false } })
  })
})

describe('normalizeOpenRouter', () => {
  it('keeps tool-capable text models and converts per-token prices to per-million', () => {
    const models = normalizeOpenRouter([
      {
        id: 'vendor/model',
        name: 'Vendor: Model',
        context_length: 100000,
        architecture: { input_modalities: ['text', 'image', 'file'], output_modalities: ['text'] },
        pricing: { prompt: '0.000003', completion: '0.000015', input_cache_read: '0.0000003' },
        top_provider: { context_length: 200000, max_completion_tokens: 64000 },
        supported_parameters: ['tools', 'reasoning'],
      },
      { id: 'vendor/no-tools', supported_parameters: ['temperature'] },
    ])
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: 'vendor/model',
      api: 'openai-completions',
      contextWindow: 200000,
      maxTokens: 64000,
      input: ['text', 'image'],
      reasoning: { supported: true, kind: 'effort' },
      cost: { input: 3, output: 15, cacheRead: 0.3 },
    })
  })
})
