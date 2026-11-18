import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HostContext, PendingToolCall, PreToolDecision, ToolDefinition } from '../src/host/dsh.ts'
import { APPLY_TOOL, CHECK_TOOL, STATUS_TOOL, registerAgentTools } from '../src/host/tools.ts'
import { makeHost } from './host-fixture.ts'

const homes: string[] = []

async function home(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dmh-tools-'))
  homes.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

interface Harness {
  ctx: HostContext
  registered: ToolDefinition[]
  removed: string[]
  listeners: Array<(exec: PendingToolCall, next: () => Promise<PreToolDecision>) => unknown>
  off: () => boolean
  dispose: () => void
}

async function harness(): Promise<Harness> {
  const { ctx: base } = makeHost({
    home: await home(),
    providers: {
      custom: {
        displayName: 'Custom',
        api: 'openai-completions',
        baseURL: 'https://example.test/v1',
        models: [{ id: 'm-1' }],
      },
    },
  })
  const registered: ToolDefinition[] = []
  const removed: string[] = []
  const listeners: Harness['listeners'] = []
  let off = false
  const tools = {
    register(definition: ToolDefinition): () => void {
      registered.push(definition)
      return () => { removed.push(definition.name) }
    },
  }
  const ctx = {
    ...base,
    get(name: string) {
      return name === 'tools' ? tools : base.get(name)
    },
    on(name: string, listener: Harness['listeners'][number]) {
      if (name === 'tools/pre-execute') listeners.push(listener)
      return () => { off = true }
    },
  } as unknown as HostContext
  const dispose = registerAgentTools(ctx)
  return { ctx, registered, removed, listeners, off: () => off, dispose }
}

function definition(harness: Harness, name: string): ToolDefinition {
  const found = harness.registered.find(row => row.name === name)
  if (found === undefined) throw new Error(`tool ${name} was not registered`)
  return found
}

describe('registerAgentTools', () => {
  it('registers the three tools and the approval listener', async () => {
    const h = await harness()
    expect(h.registered.map(row => row.name)).toEqual([STATUS_TOOL, CHECK_TOOL, APPLY_TOOL])
    expect(h.listeners).toHaveLength(1)
    h.dispose()
    expect(h.removed.sort()).toEqual([APPLY_TOOL, CHECK_TOOL, STATUS_TOOL].sort())
    expect(h.off()).toBe(true)
  })

  it('returns local status without touching the network', async () => {
    const h = await harness()
    const result = await definition(h, STATUS_TOOL).execute({}, {}) as { routes: Array<{ id: string }> }
    expect(result.routes.some(route => route.id === 'custom')).toBe(true)
    h.dispose()
  })

  it('maps a missing diff to an actionable tool error', async () => {
    const h = await harness()
    await expect(definition(h, APPLY_TOOL).execute({ route: 'custom', revision: 1 }, {})).rejects.toThrow(/diff is no longer available/i)
    h.dispose()
  })

  it('asks for approval only for the writing tool', async () => {
    const h = await harness()
    const listener = h.listeners[0]
    if (listener === undefined) throw new Error('listener missing')
    const apply = await listener(
      { name: APPLY_TOOL, arguments: { route: 'custom', revision: 1 } },
      async () => ({ kind: 'allow' }),
    ) as PreToolDecision
    expect(apply.kind).toBe('ask')
    if (apply.kind === 'ask') {
      expect(apply.displayReason?.en).toContain('custom')
      expect(apply.displayReason?.zh).toContain('custom')
      expect(apply.reason).toContain('custom')
    }
    const read = await listener({ name: STATUS_TOOL, arguments: {} }, async () => ({ kind: 'allow' })) as PreToolDecision
    expect(read).toEqual({ kind: 'allow' })
    h.dispose()
  })

  it('rejects an invalid apply selection shape at the tool boundary', async () => {
    const h = await harness()
    await expect(definition(h, APPLY_TOOL).execute({ route: 'custom', revision: 1, selection: [{ id: 'm', mode: 'explode' }] }, {})).rejects.toThrow(/arguments were rejected/i)
    h.dispose()
  })
})
