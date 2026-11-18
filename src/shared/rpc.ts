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

/**
 * Credential reference the Models page derives for a route that declares none:
 * the route id uppercased, non-alphanumerics folded to `_`, plus `_API_KEY`.
 * Clones use it so each cloned route owns an independent credential.
 */
export function deriveKeyRef(route: string): string {
  return `${route.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/** One tier of a context-sensitive price; applies when prompt tokens exceed the threshold. */
export interface PriceTier {
  inputTokensAbove: number
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

/** USD per 1M tokens; tiers price by input context size. */
export interface Price {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  tiers?: PriceTier[]
}

/** Where the price shown for one model came from, high → low priority. */
export type PriceSource = 'override' | 'snapshot' | 'template' | 'none'

/** One model's resolved price row in the price table (read-only view). */
export interface ModelPriceView {
  id: string
  name?: string
  /** Resolved unit price; absent when no layer had one. */
  price?: Price
  source: PriceSource
  /** Data fetch time of the snapshot this price came from, when it came from one. */
  fetchedAt?: string
  online?: boolean
  staleReason?: string
}

/** One route's price table. */
export interface RoutePricesView {
  route: string
  displayName: string
  declared: boolean
  bound: boolean
  template?: string
  /** Route-level price snapshot time (clone/check update), when one exists. */
  fetchedAt?: string
  online?: boolean
  staleReason?: string
  models: ModelPriceView[]
}

export interface PricesResult {
  routes: RoutePricesView[]
}

export interface SetPriceOverrideArgs {
  route: string
  model: string
  /** `null` clears the override and falls back to the snapshot/template price. */
  price: Price | null
}

export interface SetPriceOverrideResult {
  route: string
  model: string
  /** The override in force after this call, or absent when cleared. */
  override?: Price
}

// ---------------------------------------------------------------------------
// M2 domain: local price table, token usage projection
// ---------------------------------------------------------------------------

/**
 * Two projection keys carry token usage, partitioned by route
 * (provider/model) and billing bucket. Amounts are never projected: the
 * Client prices these buckets with its in-memory local price table.
 *
 * Totals stay summary-visible (small, carried by every session-list row) so
 * the session header can include subagent Sessions without opening their
 * logs. Per-turn detail is attached-Session-only and therefore not a summary
 * key; keeping it out avoids shipping every turn of every listed Session.
 */
export const USAGE_TOTALS_KEY = 'modelsHelperUsage'
export const USAGE_TURNS_KEY = 'modelsHelperTurns'

/** Mutually exclusive billing buckets of one or more assistant attempts. */
export interface UsageBuckets {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** Route id → model id → buckets. */
export type UsageRoutes = Record<string, Record<string, UsageBuckets>>

/** Route that produced one attempt. */
export interface UsageRouteRef {
  provider: string
  model: string
}

/**
 * The most recent attempt sample, kept so a duplicate settlement for the same
 * (turn, step) replaces instead of double-counting. Clients ignore it.
 */
export interface UsageLastSample extends UsageRouteRef {
  turn: number
  step: number
  buckets: UsageBuckets
}

/** Whole-session usage value (summary-visible). */
export interface UsageTotalsProjection {
  totals: UsageRoutes
  /** Replacement slot; kept in the wire value because `view` reuses state. */
  last?: UsageLastSample
  /** Route of the latest request, used to attribute stream-only attempts. */
  route?: UsageRouteRef
}

/** Per-turn usage value (attached Session only). */
export interface UsageTurnsProjection {
  /** Turn number (decimal string) → route → model → buckets. */
  turns: Record<string, UsageRoutes>
  last?: UsageLastSample
  route?: UsageRouteRef
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

/** One cloned route's independent credential reference and how it was obtained. */
export interface ClonedRouteKey {
  route: string
  ref: string
  /**
   * `copied` — the source route's key was copied into `ref`;
   * `source-missing` — the source route had no resolvable key;
   * `unavailable` — the credential service is unavailable;
   * `copy-failed` — the copy write failed.
   */
  status: 'copied' | 'source-missing' | 'unavailable' | 'copy-failed'
}

export interface CloneApplyResult {
  routes: string[]
  /** Independent credential reference chosen for each created route. */
  keys?: ClonedRouteKey[]
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
  /** Other routes sharing this route's credential reference. */
  sharedKeyWith?: string[]
}

/** Result of giving a route its own credential reference. */
export interface SeparateKeyResult {
  /** The reference now recorded on the route. */
  ref: string
  /** False when the route already owned its derived reference. */
  copied: boolean
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
  /** Stable code for `error`; the Client localizes this instead of the message. */
  errorCode?: string
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

export interface SetAutoIncludeArgs {
  route: string
  autoIncludeNew: boolean
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
  'binding.setAutoInclude': { args: SetAutoIncludeArgs; result: BindingView }
  'binding.unbind': { args: UnbindArgs; result: Record<string, never> }
  'route.separateKey': { args: { route: string }; result: SeparateKeyResult }
  'defaultModel.use': { args: DefaultModelUseArgs; result: DefaultModelUseResult }
  'prices.list': { args: Record<string, never>; result: PricesResult }
  'prices.setOverride': { args: SetPriceOverrideArgs; result: SetPriceOverrideResult }
}

export type RpcMethodName = keyof RpcMethods
