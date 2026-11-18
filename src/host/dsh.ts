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

/** `@deepseek-ai/dsh-agent-default-model` service (README.zh.md "使用本包"). */
export interface DefaultModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface AgentDefaultModelService {
  currentSelection(): DefaultModelSelection | undefined
  saveSelection(selection: DefaultModelSelection): Promise<void>
}

/**
 * `@deepseek-ai/dsh-credentials` seam (`ctx.credentials`). `resolve` returns the
 * current value, which is what lets cloning copy the source route's key into a
 * credential reference the clone owns.
 */
export interface CredentialsService {
  resolve(ref: string): Promise<{ value: string } | undefined>
  set(ref: string, value: string): Promise<unknown>
  unset(ref: string): Promise<unknown>
}

// ---------------------------------------------------------------------------
// Tool registry (`@deepseek-ai/dsh-tools`)
//
// The registry accepts a plain definition object and only calls
// `output.render`/`execute`, so the bundle can register tools without
// importing any DSH package. Shapes mirror the installed 0.2.2-rc.2 source.
// ---------------------------------------------------------------------------

/** One model-facing content block returned by a tool renderer. */
export interface ToolContentBlock {
  type: 'text'
  text: string
}

/** Execution identity passed to a tool body. */
export interface ToolRunContext {
  readonly signal?: AbortSignal
  readonly callId?: string
  readonly agent?: unknown
}

/** Canonical output declaration required by `tools.register`. */
export interface ToolOutputDefinition {
  readonly schema: Record<string, unknown>
  render(args: unknown, value: unknown): ToolContentBlock[]
}

/** One registered tool definition. */
export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly output: ToolOutputDefinition
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>
  readonly timeoutMs?: number
  isConcurrencySafe?(args: unknown): boolean
}

/** `ctx.tools` surface used by this plugin. */
export interface ToolsService {
  register(definition: ToolDefinition): () => void
}

/** Decision returned by a `tools/pre-execute` listener. */
export type PreToolDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'cancel' }
  | { kind: 'ask'; reason?: string; displayReason?: { readonly en: string; readonly [locale: string]: string } }

/** The pending call a `tools/pre-execute` listener receives. */
export interface PendingToolCall {
  readonly name: string
  readonly arguments: unknown
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
  get(name: 'agentDefaultModel'): AgentDefaultModelService | undefined
  get(name: 'credentials'): CredentialsService | undefined
  get(name: 'sessionProjections'): SessionProjectionRegistry | undefined
  get(name: 'tools'): ToolsService | undefined
  get(name: string): unknown
  effect(callback: () => (() => unknown) | void, label?: string): () => Promise<void>
  inject(deps: string[], callback: (ctx: HostContext) => void): unknown
  on(name: string, listener: (...args: any[]) => unknown): () => void
}

// ---------------------------------------------------------------------------
// Session projection registry (`@deepseek-ai/dsh-session-projection`)
//
// The registry only calls `stateSchema.parse` / `wire.viewSchema.parse` and
// invokes `init` / `apply` / `view`, so a plain-JavaScript bundle can pass
// duck-typed schema objects instead of a zod instance. Shapes mirror the
// installed 0.2.2-rc.2 source, not a DSH import.
// ---------------------------------------------------------------------------

/** One committed session event; only `type` and `data` are consumed. */
export interface SessionEvent {
  type: string
  data: unknown
}

/** Minimal parse face the registry needs from a schema. */
export interface ProjectionSchema<T> {
  parse(value: unknown): T
}

/** Client-visible value declaration of a projection unit. */
export interface ProjectionWire<T> {
  viewSchema: ProjectionSchema<T>
  view(state: T): T
  /** Whether session summaries carry this key; omitted means true. */
  summary?: boolean
}

/** One projection unit definition. */
export interface SessionProjectionDefinition<T = any> {
  key: string
  stateVersion: number
  stateSchema: ProjectionSchema<T>
  init(header: unknown, inheritedEventCount: number): T
  apply(state: T, event: SessionEvent): T
  wire?: ProjectionWire<T>
}

export interface ProjectionHandle {
  dispose(): Promise<void>
}

/** `ctx.sessionProjections` registry surface used by this plugin. */
export interface SessionProjectionRegistry {
  register(definition: SessionProjectionDefinition): Promise<ProjectionHandle>
  summaryKeys(): ReadonlySet<string>
}
