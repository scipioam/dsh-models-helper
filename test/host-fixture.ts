/** Minimal in-memory HostContext for action tests (no DSH runtime, no network). */
import type { HostContext, LlmConfigurableProvider, SettingsDescriptor, SettingsPathOp } from '../src/host/dsh.ts'

export interface FakeHostState {
  providers: Record<string, Record<string, unknown>>
  bindings: Record<string, Record<string, unknown>>
  priceOverrides: Record<string, Record<string, unknown>>
  credentials: Map<string, string>
  revision: number
  mutateCalls: { ns: string; ops: readonly SettingsPathOp[] }[]
  mutateAttempts: number
}

export interface FakeHostOptions {
  home: string
  providers?: Record<string, Record<string, unknown>>
  bindings?: Record<string, Record<string, unknown>>
  priceOverrides?: Record<string, Record<string, unknown>>
  credentials?: Record<string, string>
  /** Route ids reported as hand-declared (`declared: true`). */
  declared?: string[]
  /** Throw this many revision conflicts before accepting a mutate (concurrency simulation). */
  conflictMutates?: number
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function setPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let cursor: Record<string, unknown> = target
  for (const key of path.slice(0, -1)) {
    const next = cursor[key]
    if (next === null || typeof next !== 'object' || Array.isArray(next)) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[path[path.length - 1] as string] = clone(value)
}

function unsetPath(target: Record<string, unknown>, path: readonly string[]): void {
  let cursor: Record<string, unknown> = target
  for (const key of path.slice(0, -1)) {
    const next = cursor[key]
    if (next === null || typeof next !== 'object' || Array.isArray(next)) return
    cursor = next as Record<string, unknown>
  }
  delete cursor[path[path.length - 1] as string]
}

export function makeHost(options: FakeHostOptions): { ctx: HostContext; state: FakeHostState } {
  let pendingConflicts = options.conflictMutates ?? 0
  const state: FakeHostState = {
    providers: clone(options.providers ?? {}),
    bindings: clone(options.bindings ?? {}),
    priceOverrides: clone(options.priceOverrides ?? {}),
    credentials: new Map(Object.entries(options.credentials ?? {})),
    revision: 1,
    mutateCalls: [],
    mutateAttempts: 0,
  }
  const declared = new Set(options.declared ?? [])
  const rows = (): { llm: Record<string, unknown>; helper: Record<string, unknown> } => ({
    llm: { ns: 'llm-pi-ai', providers: Object.keys(state.providers).length === 0 ? undefined : state.providers },
    helper: { bindings: state.bindings, priceOverrides: state.priceOverrides },
  })
  const descriptor = (ns: string): SettingsDescriptor | undefined => {
    const current = rows()
    const value = ns === 'llm-pi-ai' ? current.llm : ns === 'models-helper' ? current.helper : undefined
    if (value === undefined) return undefined
    return { ns, schema: {}, value: clone(value), user: clone(value), revision: state.revision }
  }
  const settings = {
    describe: () => [descriptor('llm-pi-ai'), descriptor('models-helper')].filter((row): row is SettingsDescriptor => row !== undefined),
    mutate: async (ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void> => {
      state.mutateAttempts += 1
      if (pendingConflicts > 0) {
        pendingConflicts -= 1
        state.revision += 1
        throw new Error('settings: the section changed since it was read')
      }
      if (expectedRevision !== undefined && expectedRevision !== state.revision) {
        throw new Error('settings: the section changed since it was read')
      }
      if (ns !== 'llm-pi-ai' && ns !== 'models-helper') throw new Error(`unknown namespace ${ns}`)
      state.mutateCalls.push({ ns, ops })
      const target = ns === 'llm-pi-ai'
        ? { providers: state.providers } as Record<string, unknown>
        : { bindings: state.bindings, priceOverrides: state.priceOverrides } as Record<string, unknown>
      for (const op of ops) {
        if (op.op === 'set') setPath(target, op.path, op.value)
        else unsetPath(target, op.path)
      }
      state.revision += 1
    },
  }
  const llm = {
    listConfigurableProviders: (): LlmConfigurableProvider[] => Object.keys(state.providers).map(provider => ({
      provider,
      displayName: provider,
      settingsNs: 'llm-pi-ai',
      settingsPath: ['providers', provider],
      declared: declared.has(provider),
      defaultBaseURL: typeof state.providers[provider]?.['baseURL'] === 'string' ? state.providers[provider]?.['baseURL'] as string : undefined,
    })),
  }
  const credentials = {
    resolve: async (ref: string) => state.credentials.has(ref) ? { value: state.credentials.get(ref) as string } : undefined,
    set: async (ref: string, value: string) => { state.credentials.set(ref, value) },
    unset: async (ref: string) => { state.credentials.delete(ref) },
  }
  const services: Record<string, unknown> = { settings, llm, credentials }
  const ctx = {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    fiber: { entry: { id: 'models-helper', options: { id: 'models-helper' }, parent: { tree: { ctx: {} } } } },
    root: {},
    get: (name: string) => services[name],
    effect: () => () => undefined,
    inject: () => undefined,
    on: () => () => undefined,
  }
  // `profileContext` is read through get() but its home is per test.
  services['profileContext'] = { home: options.home, name: 'web' }
  return { ctx: ctx as unknown as HostContext, state }
}
