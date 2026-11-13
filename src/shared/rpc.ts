/**
 * Client ↔ Host RPC contract. One exact Fetch route carries every method; the
 * envelope is the Connection `client-request` / `server-response` pair so the
 * Client can use `ctx.connection.rpc.call('/api', RPC_ENDPOINT, …)`.
 */

/** Endpoint below `/api`; the Host registers `/api/<RPC_ENDPOINT>`. */
export const RPC_ENDPOINT = 'dsh-models-helper/rpc'

/** Package name; also the Client module id and locale namespace prefix. */
export const PACKAGE_NAME = 'dsh-models-helper'

/** Payload of one call. */
export interface RpcCall<M extends keyof RpcMethods = keyof RpcMethods> {
  method: M
  args: RpcMethods[M]['args']
}

/** Failure carried by the Connection result envelope. */
export interface RpcFailure {
  code: string
  message: string
  details: object
}

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: RpcFailure }

// ---------------------------------------------------------------------------
// M1 domain: models, routes, bindings, diffs
// ---------------------------------------------------------------------------

/** Wire protocols a pi-ai custom route may declare. */
export type Protocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'

/** USD per 1M tokens; tiers price by input context size. */
export interface Price {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  tiers?: { inputTokensAbove: number; input: number; output: number; cacheRead?: number; cacheWrite?: number }[]
}

/** Where a binding reads its metadata from. */
export type SourceRef = { kind: 'models-dev'; provider: string } | { kind: 'openrouter' }

/** Model fields the plugin manages; ordering is the display order in diffs. */
export const MODEL_FIELDS = ['name', 'contextWindow', 'maxTokens', 'input', 'reasoningEfforts', 'compat'] as const
export type ModelFieldName = typeof MODEL_FIELDS[number]

/** A merged model: exactly the fields written to `llm-pi-ai`, all optional. */
export interface ModelFields {
  name?: string
  contextWindow?: number
  maxTokens?: number
  input?: ('text' | 'image')[]
  /** pi-ai spellings per thinking level; `false` disables reasoning. */
  reasoningEfforts?: false | Record<string, string | null>
  compat?: Record<string, unknown>
}

/** Which layer a merged field came from. */
export type Provenance = 'source' | 'template' | 'inferred' | 'same'

/** One model as computed for cloning; no hand-edit state involved. */
export interface PlannedModel {
  id: string
  inTemplate: boolean
  /** Present on the route only because the installed catalog has it. */
  templateOnly: boolean
  fields: ModelFields
  provenance: Partial<Record<ModelFieldName, Provenance>>
  /** Source price, falling back to the installed catalog's cost. */
  price?: Price
}

/** One protocol group of a clone plan. */
export interface CloneGroup {
  api: Protocol
  baseURL: string
  suggestedId: string
  suggestedName: string
  autoIncludeNew: boolean
  routeCompat: Record<string, unknown>
  models: PlannedModel[]
  /** Models whose template declared compat switches this protocol withholds. */
  withheldCompat: number
  /** Models present only in the installed catalog (not in the source). */
  templateOnly: number
  /** Models present only in the source (no installed template). */
  noTemplate: number
}

/** Result of `clone.plan`: a forced online read is attempted first. */
export interface ClonePlan {
  provider: string
  source: SourceRef
  sourceName?: string
  fetchedAt: string
  online: boolean
  staleReason?: string
  templateVersion?: string
  groups: CloneGroup[]
  warnings: string[]
}

/** Client's choice per protocol group in `clone.apply`. */
export interface CloneGroupChoice {
  api: Protocol
  baseURL: string
  routeId: string
  displayName: string
  autoIncludeNew: boolean
  modelIds: string[]
}

export interface CloneApplyArgs {
  provider: string
  source: SourceRef
  groups: CloneGroupChoice[]
}

export interface CloneApplyResult {
  routes: string[]
  /** Set when the current default model pointed at the source route and a clone has it. */
  defaultSuggestion?: { provider: string; model: string; reasoningEffort?: string }
  warnings: string[]
}

/** Candidate sources and templates for binding an existing custom route. */
export interface BindSources {
  source: SourceRef
  label: string
  modelCount: number
}

export interface BindOptions {
  route: string
  api: Protocol
  baseURL: string
  sources: BindSources[]
  templates: string[]
}

/** Route summary plus binding state used by the provider-card panels. */
export interface BindingView {
  route: string
  source: SourceRef
  template: string
  api: Protocol
  baseURL: string
  autoIncludeNew: boolean
  lastSync?: string
  locked: string[]
}

export interface RouteInfo {
  id: string
  displayName: string
  declared: boolean
  apiKeyEnv?: string
  api?: string
  baseURL?: string
  modelCount: number
  bound: boolean
  binding?: BindingView
  /** A binding exists but the route is gone from llm-pi-ai. */
  orphanBinding?: boolean
  /** Other cloned routes sharing this route's credential reference. */
  sharedKeyWith?: string[]
}

/** One cached metadata document, read from disk without any network call. */
export interface CacheEntry {
  fetchedAt?: string
  checkedAt?: string
  staleReason?: string
  size?: number
}

export interface CacheStatus {
  modelsDev: CacheEntry
  openrouter: CacheEntry
}

export interface HelperStatus {
  routes: RouteInfo[]
  bindings: BindingView[]
  template: { version?: string; providers?: string[]; error?: string }
  defaultSelection?: { provider: string; model: string; reasoningEffort?: string }
  cache: CacheStatus
  llmRevision?: number
}

/** One field's change in a diff. `old`/`new` are JSON values of the field. */
export interface FieldDiff {
  field: ModelFieldName
  old?: unknown
  new?: unknown
  provenance: Provenance
}

export type DiffKind = 'added' | 'candidate' | 'update' | 'conflict' | 'removed'

export interface ModelDiff {
  id: string
  kind: DiffKind
  defaultChecked: boolean
  fields: FieldDiff[]
}

/** A source-price change noticed during the same check. Read-only in the panel. */
export interface PriceChange {
  id: string
  old?: Price
  new?: Price
  overridden: boolean
}

export interface BindingDiff {
  route: string
  source: SourceRef
  template: string
  api: Protocol
  baseURL: string
  revision: number
  /** When the source data shown here was actually fetched. */
  fetchedAt: string
  online: boolean
  staleReason?: string
  added: ModelDiff[]
  candidates: ModelDiff[]
  updates: ModelDiff[]
  conflicts: ModelDiff[]
  removed: ModelDiff[]
  priceChanges: PriceChange[]
  locked: string[]
  /** Set when this route cannot be checked (e.g. the route disappeared). */
  error?: string
  /** Non-fatal condition, e.g. the installed template is unavailable. */
  warning?: string
}

export interface DiffArgs {
  /** Omit to check every binding. */
  route?: string
}

export interface DiffResult {
  results: BindingDiff[]
}

export interface BindingBindArgs {
  route: string
  option: { source: SourceRef; template: string; api: Protocol; baseURL: string }
}

export interface BindingBindResult {
  binding: BindingView
  diff: BindingDiff
}

/** One model's selection in `binding.apply`. */
export interface ApplySelection {
  id: string
  mode: 'add' | 'update' | 'remove'
  /** For `update`: the fields to take from the diff. */
  fields?: ModelFieldName[]
}

export interface ApplyArgs {
  route: string
  revision: number
  selection: ApplySelection[]
}

export interface ApplyResult {
  route: string
  changed: number
  revision: number
}

export interface LockArgs {
  route: string
  model: string
  field: ModelFieldName
  locked: boolean
}

export interface LockResult {
  locked: string[]
}

export interface UnbindArgs {
  route: string
}

export interface DefaultModelUseArgs {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface DefaultModelUseResult {
  applied: boolean
}

export interface CacheRefreshResult {
  cache: CacheStatus
  online: boolean
  staleReason?: string
}

// ---------------------------------------------------------------------------
// Method table
// ---------------------------------------------------------------------------

export interface RpcMethods {
  'helper.status': { args: Record<string, never>; result: HelperStatus }
  'cache.refresh': { args: Record<string, never>; result: CacheRefreshResult }
  'clone.plan': { args: { provider: string; source?: SourceRef }; result: ClonePlan }
  'clone.apply': { args: CloneApplyArgs; result: CloneApplyResult }
  'bind.options': { args: { route: string }; result: BindOptions }
  'binding.bind': { args: BindingBindArgs; result: BindingBindResult }
  'binding.diff': { args: DiffArgs; result: DiffResult }
  'binding.apply': { args: ApplyArgs; result: ApplyResult }
  'binding.lock': { args: LockArgs; result: LockResult }
  'binding.unbind': { args: UnbindArgs; result: Record<string, never> }
  'defaultModel.use': { args: DefaultModelUseArgs; result: DefaultModelUseResult }
}

export type RpcMethodName = keyof RpcMethods
