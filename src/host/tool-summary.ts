/**
 * Bounded model-facing projections of the Host status and check-update
 * results. Tool results enter the session log and the next request, so a raw
 * 400-model diff must never be returned verbatim: each group is counted fully
 * and only a bounded sample of rows is shown, with explicit truncation.
 */
import type {
  ApplySelection,
  BindingDiff,
  DiffKind,
  DiffResult,
  HelperStatus,
  ModelDiff,
  ModelFieldName,
  Price,
  Provenance,
  Protocol,
  SourceRef,
} from '../shared/rpc.ts'
import { defaultApplySelection } from '../shared/selection.ts'

const MAX_ROUTES = 100
const MAX_BINDINGS = 100
const MAX_RESULTS = 20
const MAX_MODELS_PER_ROUTE = 20
const MAX_TOTAL_MODELS = 120
const MAX_PRICE_CHANGES = 10
const MAX_SELECTION = 100
const MAX_VALUE_CHARS = 140
const MAX_REASON_CHARS = 240
const MAX_SHARED_KEYS = 10

/** One compacted field value: either the original JSON value or a preview. */
export interface ToolValue {
  value?: unknown
  preview?: string
  truncated: boolean
}

export interface ToolFieldChange {
  field: ModelFieldName
  provenance: Provenance
  old: ToolValue
  new: ToolValue
}

export interface ToolModelRow {
  id: string
  kind: DiffKind
  defaultChecked: boolean
  fields: ToolFieldChange[]
}

export interface ToolPriceChange {
  id: string
  old: ToolValue
  new: ToolValue
  overridden: boolean
}

export interface ToolCacheEntry {
  fetchedAt?: string
  checkedAt?: string
  staleReason?: string
}

export interface ToolStatusSummary {
  template: { version?: string; providerCount?: number; error?: string }
  defaultModel?: { provider: string; model: string; reasoningEffort?: string }
  cache: { modelsDev: ToolCacheEntry; openrouter: ToolCacheEntry }
  routes: Array<{
    id: string
    displayName: string
    declared: boolean
    modelCount: number
    bound: boolean
    api?: string
    baseURL?: string
    sharedKeyWith?: string[]
    orphanBinding?: boolean
  }>
  bindings: Array<{
    route: string
    source: SourceRef
    template: string
    api: Protocol
    autoIncludeNew: boolean
    lastSync?: string
    lockedCount: number
  }>
  llmRevision?: number
  truncated?: { routes?: number; bindings?: number }
}

export interface ToolCheckRoute {
  route: string
  source: SourceRef
  template: string
  api: Protocol
  online: boolean
  fetchedAt: string
  staleReason?: string
  warning?: string
  error?: string
  revision: number
  counts: {
    added: number
    candidates: number
    updates: number
    conflicts: number
    removed: number
    priceChanges: number
    locked: number
  }
  models: ToolModelRow[]
  priceChanges: ToolPriceChange[]
  suggestedSelection?: ApplySelection[]
  suggestedSelectionOmitted?: boolean
  truncated?: { models?: number; priceChanges?: number }
}

export interface ToolCheckSummary {
  results: ToolCheckRoute[]
  truncated?: { results: number }
}

function compactReason(text: string | undefined): string | undefined {
  if (text === undefined || text.length === 0) return undefined
  return text.length <= MAX_REASON_CHARS ? text : `${text.slice(0, MAX_REASON_CHARS - 1)}…`
}

/** Keep a value only when small enough to stay useful in the context. */
export function compactValue(value: unknown): ToolValue {
  if (value === undefined) return { truncated: false }
  let text: string
  try {
    text = JSON.stringify(value) ?? 'undefined'
  } catch {
    return { preview: '[unserializable]', truncated: true }
  }
  if (text.length <= MAX_VALUE_CHARS) return { value, truncated: false }
  return { preview: `${text.slice(0, MAX_VALUE_CHARS - 1)}…`, truncated: true }
}

function compactFields(row: ModelDiff): ToolFieldChange[] {
  return row.fields.map(field => ({
    field: field.field,
    provenance: field.provenance,
    old: compactValue(field.old),
    new: compactValue(field.new),
  }))
}

function compactModel(row: ModelDiff): ToolModelRow {
  return { id: row.id, kind: row.kind, defaultChecked: row.defaultChecked, fields: compactFields(row) }
}

function compactPrice(price: Price | undefined): ToolValue {
  return compactValue(price)
}

function cacheEntry(entry: HelperStatus['cache']['modelsDev']): ToolCacheEntry {
  return {
    ...entry.fetchedAt === undefined ? {} : { fetchedAt: entry.fetchedAt },
    ...entry.checkedAt === undefined ? {} : { checkedAt: entry.checkedAt },
    ...entry.staleReason === undefined ? {} : { staleReason: compactReason(entry.staleReason) },
  }
}

/** Status is small even with many routes; still cap it for pathological setups. */
export function summaryOfStatus(status: HelperStatus): ToolStatusSummary {
  const defaultProvider = status.defaultSelection?.provider
  // `helperStatus` reads every provider the LLM service knows, including the
  // installed catalog's unconfigured built-ins. The agent needs the routes that
  // are actually in use, so drop empty catalog entries; the Models page keeps
  // showing them.
  const relevant = status.routes.filter(route =>
    route.modelCount > 0
    || route.bound
    || route.id === defaultProvider
    || (route.sharedKeyWith?.length ?? 0) > 0)
  const routes = relevant.slice(0, MAX_ROUTES).map(route => ({
    id: route.id,
    displayName: route.displayName,
    declared: route.declared,
    modelCount: route.modelCount,
    bound: route.bound,
    ...route.api === undefined ? {} : { api: route.api },
    ...route.baseURL === undefined ? {} : { baseURL: route.baseURL },
    ...route.sharedKeyWith === undefined || route.sharedKeyWith.length === 0
      ? {}
      : { sharedKeyWith: route.sharedKeyWith.slice(0, MAX_SHARED_KEYS) },
    ...route.orphanBinding === true ? { orphanBinding: true } : {},
  }))
  const bindings = status.bindings.slice(0, MAX_BINDINGS).map(binding => ({
    route: binding.route,
    source: binding.source,
    template: binding.template,
    api: binding.api,
    autoIncludeNew: binding.autoIncludeNew,
    ...binding.lastSync === undefined ? {} : { lastSync: binding.lastSync },
    lockedCount: binding.locked.length,
  }))
  const truncated: NonNullable<ToolStatusSummary['truncated']> = {}
  if (relevant.length > routes.length) truncated.routes = relevant.length - routes.length
  if (status.bindings.length > bindings.length) truncated.bindings = status.bindings.length - bindings.length
  const template = status.template.error !== undefined
    ? { error: compactReason(status.template.error) ?? status.template.error }
    : {
        ...status.template.version === undefined ? {} : { version: status.template.version },
        providerCount: status.template.providers?.length ?? 0,
      }
  return {
    template,
    ...status.defaultSelection === undefined ? {} : { defaultModel: status.defaultSelection },
    cache: { modelsDev: cacheEntry(status.cache.modelsDev), openrouter: cacheEntry(status.cache.openrouter) },
    routes,
    bindings,
    ...status.llmRevision === undefined ? {} : { llmRevision: status.llmRevision },
    ...Object.keys(truncated).length === 0 ? {} : { truncated },
  }
}

/** Count a selection by mode, counting chosen fields for update rows. */
export function countSelection(selection: readonly ApplySelection[]): { add: number; update: number; remove: number; fields: number } {
  let add = 0
  let update = 0
  let remove = 0
  let fields = 0
  for (const item of selection) {
    if (item.mode === 'add') add += 1
    else if (item.mode === 'remove') remove += 1
    else {
      update += 1
      fields += item.fields?.length ?? 0
    }
  }
  return { add, update, remove, fields }
}

function truncationOf(rows: number, shown: number, prices: number, shownPrices: number): ToolCheckRoute['truncated'] {
  const truncated: NonNullable<ToolCheckRoute['truncated']> = {}
  if (rows > shown) truncated.models = rows - shown
  if (prices > shownPrices) truncated.priceChanges = prices - shownPrices
  return Object.keys(truncated).length === 0 ? undefined : truncated
}

function summarizeRoute(diff: BindingDiff, remaining: number): { row: ToolCheckRoute; used: number } {
  const rows = [...diff.added, ...diff.updates, ...diff.conflicts, ...diff.candidates, ...diff.removed]
  const shown = Math.min(rows.length, MAX_MODELS_PER_ROUTE, remaining)
  const priceChanges = diff.priceChanges.slice(0, MAX_PRICE_CHANGES)
  const suggested = diff.error === undefined ? defaultApplySelection(diff) : []
  const truncated = truncationOf(rows.length, shown, diff.priceChanges.length, priceChanges.length)
  return {
    used: shown,
    row: {
      route: diff.route,
      source: diff.source,
      template: diff.template,
      api: diff.api,
      online: diff.online,
      fetchedAt: diff.fetchedAt,
      ...diff.staleReason === undefined ? {} : { staleReason: compactReason(diff.staleReason) },
      ...diff.warning === undefined ? {} : { warning: compactReason(diff.warning) },
      ...diff.error === undefined ? {} : { error: compactReason(diff.error) },
      revision: diff.revision,
      counts: {
        added: diff.added.length,
        candidates: diff.candidates.length,
        updates: diff.updates.length,
        conflicts: diff.conflicts.length,
        removed: diff.removed.length,
        priceChanges: diff.priceChanges.length,
        locked: diff.locked.length,
      },
      models: rows.slice(0, shown).map(compactModel),
      priceChanges: priceChanges.map(change => ({
        id: change.id,
        old: compactPrice(change.old),
        new: compactPrice(change.new),
        overridden: change.overridden,
      })),
      ...suggested.length === 0 ? {} : suggested.length <= MAX_SELECTION
        ? { suggestedSelection: suggested }
        : { suggestedSelectionOmitted: true },
      ...truncated === undefined ? {} : { truncated },
    },
  }
}

/**
 * Return grouped counts for every route, with at most 20 rows per route and
 * 120 rows across the whole result. `suggestedSelection` lets the tool apply
 * the same defaults as the Models page without echoing every model.
 */
export function summaryOfCheck(result: DiffResult): ToolCheckSummary {
  const selected = result.results.slice(0, MAX_RESULTS)
  let remaining = MAX_TOTAL_MODELS
  const results: ToolCheckRoute[] = []
  for (const diff of selected) {
    const summarized = summarizeRoute(diff, remaining)
    remaining -= summarized.used
    results.push(summarized.row)
  }
  return {
    results,
    ...result.results.length > results.length ? { truncated: { results: result.results.length - results.length } } : {},
  }
}
