/**
 * Minimal structural views of the DSH Host services this plugin touches.
 * Declared locally (instead of importing DSH packages) so the bundle has no
 * runtime or type dependency on DSH internals; each shape mirrors the
 * installed 0.2.2-rc.2 contract read through Cordis inspection or source.
 */

export interface Logger {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  debug?(...args: unknown[]): void
}

export interface LoaderEntry {
  id: string
  options: { id: string; name: string; config?: unknown }
  parent: { tree: { ctx: { baseUrl?: string } } }
  fiber?: { state: number }
}

export interface ConfigEditor {
  entries(): LoaderEntry[]
  readonly documentPath: string
}

export type SettingsPathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }

export interface SettingsDescriptor {
  ns: string
  schema: unknown
  value: unknown
  revision: number
  base?: unknown
  user?: unknown
}

export interface SettingsForms {
  describe(options?: { redactSecrets?: boolean }): SettingsDescriptor[]
  mutate(ns: string, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>
}

export interface PluginPackage {
  name: string
  version: string | undefined
  dir: string
  manifest: Record<string, unknown>
}

export interface PluginPackages {
  packageOf(specifier: string, parentURL: string): PluginPackage | undefined
}

export interface ConnectionFetchRoute {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

export interface HostConnection {
  readonly fetch: { register(route: ConnectionFetchRoute): () => Promise<void> }
}

export interface LlmConfigurableProvider {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: readonly string[]
  declared?: boolean
  defaultBaseURL?: string
  error?: string
}

export interface LlmService {
  listConfigurableProviders(): LlmConfigurableProvider[]
}

export interface ProfileContext {
  readonly home: string
  readonly name: string
}

/** The subset of a Cordis Context this plugin uses. */
export interface HostContext {
  readonly logger: Logger
  readonly fiber: { entry?: LoaderEntry }
  readonly root: { loader?: { await(): Promise<void> } }
  get(name: 'settings'): SettingsForms | undefined
  get(name: 'configEditor'): ConfigEditor | undefined
  get(name: 'pluginPackages'): PluginPackages | undefined
  get(name: 'connection'): HostConnection | undefined
  get(name: 'llm'): LlmService | undefined
  get(name: 'profileContext'): ProfileContext | undefined
  get(name: string): unknown
  effect(callback: () => (() => unknown) | void, label?: string): () => Promise<void>
  inject(deps: string[], callback: (ctx: HostContext) => void): unknown
  on(name: string, listener: (...args: any[]) => unknown): () => void
}
