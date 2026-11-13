/**
 * Host-side domain vocabulary shared by the merge engine, the diff engine and
 * the action layer: pi-ai compat gates, stored binding/snapshot/price shapes,
 * and the raw config shapes read from the `llm-pi-ai` settings namespace.
 */
import type { ModelFields, ModelFieldName, Price, Protocol, SourceRef } from '../shared/rpc.ts'
export { MODEL_FIELDS } from '../shared/rpc.ts'
export type { ModelFields } from '../shared/rpc.ts'

export const LLM_PI_AI_NS = 'llm-pi-ai'

/**
 * Compat fields a custom route may set, per protocol.
 *
 * Mirrors `*_COMPAT_GATE` in the installed llm-pi-ai `src/catalog.ts` (0.2.2-rc.2):
 * every other field is *withheld* and rejected on a hand-declared route. Kept
 * as a hardcoded set because that source file is TypeScript inside another
 * package and cannot be imported; re-check it after a DSH upgrade.
 */
export const OFFERED_COMPAT: Readonly<Record<Protocol, readonly string[]>> = {
  'openai-completions': [
    'supportsStore',
    'supportsDeveloperRole',
    'supportsReasoningEffort',
    'supportsUsageInStreaming',
    'supportsFinishReason',
    'maxTokensField',
    'requiresToolResultName',
    'requiresAssistantAfterToolResult',
    'requiresThinkingAsText',
    'requiresReasoningContentOnAssistantMessages',
    'thinkingFormat',
    'chatTemplateKwargs',
    'chatTemplateArgs',
    'supportsThinkingTokenBudget',
    'thinkingTokenBudgetField',
    'vllmPriority',
    'supportsStrictMode',
    'cacheControlFormat',
    'supportsLongCacheRetention',
  ],
  'openai-responses': [
    'supportsDeveloperRole',
    'supportsMaxOutputTokens',
    'supportsStrictMode',
    'supportsLongCacheRetention',
  ],
  'anthropic-messages': [
    'supportsEagerToolInputStreaming',
    'supportsLongCacheRetention',
    'supportsCacheControlOnTools',
    'supportsTemperature',
    'forceAdaptiveThinking',
    'allowEmptySignature',
    'supportsStrictTools',
  ],
  'google-generative-ai': [],
}

/** Thinking levels pi-ai understands, in display order. */
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Levels the Gemini route accepts, and only when the value equals the level. */
export const GEMINI_LEVELS: readonly string[] = ['minimal', 'low', 'medium', 'high']

/** A `llm-pi-ai` `models[]` entry exactly as stored (only the fields we write). */
export interface RawModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  input?: string[]
  reasoningEfforts?: false | Record<string, string | null>
  compat?: Record<string, unknown>
  [key: string]: unknown
}

/** The user layer of one route under `providers.<route>`. */
export interface RawProfile {
  apiKeyEnv?: string
  displayName?: string
  api?: string
  baseURL?: string
  models?: RawModel[]
  compat?: Record<string, unknown>
  [key: string]: unknown
}

export interface RawLlmConfig {
  providers?: Record<string, RawProfile>
}

/** The route/model fields the engine manages, normalized out of a raw entry. */
export function modelFieldsOf(raw: RawModel | undefined): ModelFields {
  if (raw === undefined) return {}
  const out: ModelFields = {}
  if (typeof raw.name === 'string') out.name = raw.name
  if (typeof raw.contextWindow === 'number') out.contextWindow = raw.contextWindow
  if (typeof raw.maxTokens === 'number') out.maxTokens = raw.maxTokens
  if (Array.isArray(raw.input)) {
    const input = raw.input.filter((kind): kind is 'text' | 'image' => kind === 'text' || kind === 'image')
    if (input.length > 0) out.input = input
  }
  if (raw.reasoningEfforts === false) out.reasoningEfforts = false
  else if (raw.reasoningEfforts !== undefined && typeof raw.reasoningEfforts === 'object' && raw.reasoningEfforts !== null) {
    const efforts: Record<string, string | null> = {}
    for (const [level, value] of Object.entries(raw.reasoningEfforts)) {
      if (value === null || typeof value === 'string') efforts[level] = value
    }
    if (Object.keys(efforts).length > 0) out.reasoningEfforts = efforts
  }
  if (raw.compat !== undefined && typeof raw.compat === 'object' && raw.compat !== null && Object.keys(raw.compat).length > 0) {
    out.compat = raw.compat
  }
  return out
}

/** Present, non-undefined fields of a model, for writing. */
export function definedFields(fields: ModelFields, only?: readonly ModelFieldName[]): ModelFields {
  const out: ModelFields = {}
  const keys = only ?? (Object.keys(fields) as ModelFieldName[])
  for (const key of keys) {
    const value = fields[key]
    if (value === undefined) continue
    out[key] = value as never
  }
  return out
}

/** A stored binding: one custom route ↔ one metadata source + template + group. */
export interface Binding {
  route: string
  source: SourceRef
  template: string
  api: Protocol
  baseURL: string
  autoIncludeNew: boolean
  /** ISO time of the last successful clone/check. */
  lastSync?: string
  /** `modelId/field` pairs excluded from diffs. */
  locks: string[]
  /** Manual price overrides; refreshed snapshots never overwrite them. */
  priceOverrides: Record<string, Price>
}

/** Snapshot of the fields the plugin last wrote (or confirmed) per model. */
export interface RouteSnapshot {
  at: string
  models: Record<string, Partial<ModelFields>>
}

export interface SnapshotFile {
  routes: Record<string, RouteSnapshot>
}

/** Source prices captured at clone/check time. Read-only for the UI. */
export interface RoutePrices {
  /** When these prices were actually fetched (fallback: cache time). */
  fetchedAt: string
  online: boolean
  staleReason?: string
  models: Record<string, Price>
}

export interface PriceFile {
  routes: Record<string, RoutePrices>
}

/** Key `modelId/field` used by locks. */
export function lockKey(model: string, field: ModelFieldName): string {
  return `${model}/${field}`
}
