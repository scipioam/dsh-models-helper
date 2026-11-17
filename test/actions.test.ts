import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bindingLock, bindingSetAutoInclude, separateKey } from '../src/host/actions.ts'
import { writeBinding } from '../src/host/store.ts'
import type { Binding } from '../src/host/domain.ts'
import { makeHost } from './host-fixture.ts'

const homes: string[] = []

async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dmh-host-'))
  homes.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

function binding(route: string): Binding {
  return {
    route,
    source: { kind: 'models-dev', provider: 'openrouter' },
    template: 'openrouter',
    api: 'openai-completions',
    baseURL: 'https://openrouter.ai/api/v1',
    autoIncludeNew: true,
    locks: [],
    priceOverrides: {},
  }
}

const routeProfile = {
  displayName: 'Custom',
  api: 'openai-completions',
  baseURL: 'https://example.test/v1',
  models: [{ id: 'm' }],
}

describe('binding.setAutoInclude', () => {
  it('stores the switch and returns the updated binding', async () => {
    const { ctx, state } = makeHost({ home: await home(), bindings: { custom: { ...binding('custom') } } })
    const view = await bindingSetAutoInclude(ctx, { route: 'custom', autoIncludeNew: false })
    expect(view.autoIncludeNew).toBe(false)
    expect(state.bindings['custom']?.['autoIncludeNew']).toBe(false)
    const again = await bindingSetAutoInclude(ctx, { route: 'custom', autoIncludeNew: true })
    expect(again.autoIncludeNew).toBe(true)
    expect(state.bindings['custom']?.['autoIncludeNew']).toBe(true)
  })

  it('refuses an unbound route', async () => {
    const { ctx } = makeHost({ home: await home() })
    await expect(bindingSetAutoInclude(ctx, { route: 'missing', autoIncludeNew: false })).rejects.toThrow(/尚未绑定/)
  })
})

describe('binding.lock', () => {
  it('adds and removes field locks', async () => {
    const { ctx, state } = makeHost({ home: await home(), bindings: { custom: { ...binding('custom') } } })
    const locked = await bindingLock(ctx, { route: 'custom', model: 'm', field: 'contextWindow', locked: true })
    expect(locked.locked).toEqual(['m/contextWindow'])
    expect(state.bindings['custom']?.['locks']).toEqual(['m/contextWindow'])
    const unlocked = await bindingLock(ctx, { route: 'custom', model: 'm', field: 'contextWindow', locked: false })
    expect(unlocked.locked).toEqual([])
  })

  it('refuses an unknown field', async () => {
    const { ctx } = makeHost({ home: await home(), bindings: { custom: { ...binding('custom') } } })
    await expect(bindingLock(ctx, { route: 'custom', model: 'm', field: 'nope' as never, locked: true }))
      .rejects.toThrow(/锁参数无效/)
  })
})

describe('route.separateKey', () => {
  it('copies the shared key into the route-owned reference', async () => {
    const { ctx, state } = makeHost({
      home: await home(),
      providers: { custom: { ...routeProfile, apiKeyEnv: 'SHARED_KEY' } },
      declared: ['custom'],
      credentials: { SHARED_KEY: 'sk-test' },
    })
    const result = await separateKey(ctx, { route: 'custom' })
    expect(result).toEqual({ ref: 'CUSTOM_API_KEY', copied: true })
    expect(state.credentials.get('CUSTOM_API_KEY')).toBe('sk-test')
    expect(state.providers['custom']?.['apiKeyEnv']).toBe('CUSTOM_API_KEY')
  })

  it('is a no-op when the route already owns its derived reference', async () => {
    const { ctx, state } = makeHost({
      home: await home(),
      providers: { custom: { ...routeProfile, apiKeyEnv: 'CUSTOM_API_KEY' } },
      declared: ['custom'],
      credentials: { CUSTOM_API_KEY: 'sk-test' },
    })
    const result = await separateKey(ctx, { route: 'custom' })
    expect(result).toEqual({ ref: 'CUSTOM_API_KEY', copied: false })
    expect(state.credentials.size).toBe(1)
  })

  it('fails when the current key cannot be read', async () => {
    const { ctx } = makeHost({
      home: await home(),
      providers: { custom: { ...routeProfile, apiKeyEnv: 'SHARED_KEY' } },
      declared: ['custom'],
    })
    await expect(separateKey(ctx, { route: 'custom' })).rejects.toThrow(/无法读取/)
  })

  it('refuses a built-in route', async () => {
    const { ctx } = makeHost({
      home: await home(),
      providers: { 'built-in': { ...routeProfile } },
      declared: [],
    })
    await expect(separateKey(ctx, { route: 'built-in' })).rejects.toThrow(/只有自定义供应商/)
  })
})

describe('writeBinding', () => {
  it('retries once after another writer moved the revision', async () => {
    const { ctx, state } = makeHost({ home: await home(), conflictMutates: 1 })
    await writeBinding(ctx, binding('custom'))
    expect(state.mutateAttempts).toBe(2)
    expect(state.mutateCalls).toHaveLength(1)
    expect(state.bindings['custom']?.['route']).toBe('custom')
  })

  it('gives up after repeated revision churn', async () => {
    const { ctx } = makeHost({ home: await home(), conflictMutates: 5 })
    await expect(writeBinding(ctx, binding('custom'))).rejects.toThrow(/changed since it was read/)
  })
})
