import { describe, expect, it } from 'vitest'
import { definedFields, lockKey, modelFieldsOf } from '../src/host/domain.ts'
import { deriveKeyRef } from '../src/shared/rpc.ts'

describe('modelFieldsOf', () => {
  it('keeps only the managed fields and drops empty values', () => {
    const fields = modelFieldsOf({
      id: 'm',
      name: 'Model',
      contextWindow: 1000,
      maxTokens: 500,
      input: ['text', 'audio', 'image'],
      reasoningEfforts: { off: null, high: 'high' },
      compat: { supportsTemperature: false },
      unknown: 'ignored',
    })
    expect(fields).toEqual({
      name: 'Model',
      contextWindow: 1000,
      maxTokens: 500,
      input: ['text', 'image'],
      reasoningEfforts: { off: null, high: 'high' },
      compat: { supportsTemperature: false },
    })
  })

  it('passes through non-reasoning and drops empty compat', () => {
    expect(modelFieldsOf({ id: 'm', reasoningEfforts: false, compat: {} })).toEqual({ reasoningEfforts: false })
  })

  it('drops an empty reasoning map', () => {
    expect(modelFieldsOf({ id: 'm', reasoningEfforts: {} })).toEqual({})
  })

  it('returns an empty object for a missing entry', () => {
    expect(modelFieldsOf(undefined)).toEqual({})
  })
})

describe('definedFields', () => {
  it('drops undefined values', () => {
    expect(definedFields({ name: 'x', contextWindow: undefined, maxTokens: 10 })).toEqual({ name: 'x', maxTokens: 10 })
  })

  it('honours an explicit field list', () => {
    expect(definedFields({ name: 'x', contextWindow: 100, maxTokens: 10 }, ['contextWindow'])).toEqual({ contextWindow: 100 })
  })
})

describe('lockKey', () => {
  it('uses model/field pairs', () => {
    expect(lockKey('claude-x', 'contextWindow')).toBe('claude-x/contextWindow')
  })
})

describe('deriveKeyRef', () => {
  it('matches the credential reference the Models page derives', () => {
    expect(deriveKeyRef('openrouter-custom')).toBe('OPENROUTER_CUSTOM_API_KEY')
    expect(deriveKeyRef('opencode-go-anthropic')).toBe('OPENCODE_GO_ANTHROPIC_API_KEY')
  })
})
