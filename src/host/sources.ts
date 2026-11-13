/**
 * Metadata sources: models.dev and OpenRouter's public model list, read
 * through the disk cache and normalized to {@link SourceModel}.
 */
import { cachedFetch } from './cache.ts'

export const MODELS_DEV_URL = 'https://models.dev/api.json'
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
export const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000

/** Wire protocols a pi-ai custom route may declare. */
export type Protocol = 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'

export interface Price {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  tiers?: { inputTokensAbove: number; input: number; output: number; cacheRead?: number; cacheWrite?: number }[]
}

export interface SourceModel {
  id: string
  name?: string
  family?: string
  api?: Protocol
  baseURL?: string
  /** npm adapter the source names, kept when it maps to no supported protocol. */
  npm?: string
  contextWindow?: number
  maxTokens?: number
  input?: ('text' | 'image')[]
  reasoning?: { supported: boolean; kind?: 'effort' | 'toggle' | 'budget'; efforts?: string[] }
  cost?: Price
  releaseDate?: string
  status?: string
  /** OpenRouter: endpoints the model accepts (e.g. `/api/v1/messages`). */
  endpoints?: string[]
}

export interface SourceSnapshot {
  models: SourceModel[]
  fetchedAt: number
  staleReason?: string
}

const NPM_PROTOCOL: Record<string, Protocol> = {
  '@ai-sdk/openai-compatible': 'openai-completions',
  '@ai-sdk/openai': 'openai-responses',
  '@ai-sdk/anthropic': 'anthropic-messages',
  '@ai-sdk/google': 'google-generative-ai',
  '@openrouter/ai-sdk-provider': 'openai-completions',
}

/** Map a models.dev npm adapter name to a pi-ai protocol. */
export function protocolOfNpm(npm: string | undefined): Protocol | undefined {
  return npm === undefined ? undefined : NPM_PROTOCOL[npm]
}

/**
 * Normalize a base URL for a protocol: Anthropic Messages SDKs append
 * `/v1/messages`, so a trailing `/v1` is dropped; trailing slashes always are.
 */
export function normalizeBaseURL(api: Protocol | undefined, url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  let out = url.replace(/\/+$/, '')
  if (api === 'anthropic-messages') out = out.replace(/\/v1$/, '')
  return out
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function modalities(list: unknown): ('text' | 'image')[] | undefined {
  if (!Array.isArray(list)) return undefined
  const out = (['text', 'image'] as const).filter(kind => list.includes(kind))
  return out.length > 0 ? [...out] : undefined
}

// ---------------------------------------------------------------------------
// models.dev
// ---------------------------------------------------------------------------

interface ModelsDevCost {
  input?: number
  output?: number
  cache_read?: number
  cache_write?: number
  tiers?: { input?: number; output?: number; cache_read?: number; cache_write?: number; tier?: { type?: string; size?: number } }[]
}

interface ModelsDevModel {
  id: string
  name?: string
  family?: string
  reasoning?: boolean
  reasoning_options?: { type: string; values?: string[] }[]
  modalities?: { input?: string[]; output?: string[] }
  limit?: { context?: number; output?: number }
  cost?: ModelsDevCost
  provider?: { npm?: string; api?: string }
  release_date?: string
  status?: string
  tool_call?: boolean
  type?: string
}

interface ModelsDevProvider {
  id: string
  name?: string
  npm?: string
  api?: string
  env?: string[]
  models: Record<string, ModelsDevModel>
}

function modelsDevPrice(cost: ModelsDevCost | undefined): Price | undefined {
  const input = finite(cost?.input)
  const output = finite(cost?.output)
  if (input === undefined || output === undefined) return undefined
  const tiers = (cost?.tiers ?? []).flatMap((tier) => {
    const above = positiveInt(tier.tier?.size)
    const tin = finite(tier.input)
    const tout = finite(tier.output)
    if (tier.tier?.type !== 'context' || above === undefined || tin === undefined || tout === undefined) return []
    return [{
      inputTokensAbove: above,
      input: tin,
      output: tout,
      ...finite(tier.cache_read) === undefined ? {} : { cacheRead: finite(tier.cache_read) },
      ...finite(tier.cache_write) === undefined ? {} : { cacheWrite: finite(tier.cache_write) },
    }]
  })
  return {
    input,
    output,
    ...finite(cost?.cache_read) === undefined ? {} : { cacheRead: finite(cost?.cache_read) },
    ...finite(cost?.cache_write) === undefined ? {} : { cacheWrite: finite(cost?.cache_write) },
    ...tiers.length > 0 ? { tiers } : {},
  }
}

function modelsDevReasoning(model: ModelsDevModel): SourceModel['reasoning'] {
  if (model.reasoning !== true) return { supported: false }
  const options = model.reasoning_options ?? []
  const effort = options.find(option => option.type === 'effort')
  if (effort !== undefined) return { supported: true, kind: 'effort', efforts: [...effort.values ?? []] }
  if (options.some(option => option.type === 'budget_tokens')) return { supported: true, kind: 'budget' }
  if (options.some(option => option.type === 'toggle')) return { supported: true, kind: 'toggle' }
  return { supported: true }
}

/** Normalize one models.dev provider. */
export function normalizeModelsDevProvider(provider: ModelsDevProvider): SourceModel[] {
  return Object.values(provider.models).flatMap((model) => {
    // pi-ai only serves chat models that call tools; models.dev marks others.
    if (model.type !== undefined && model.type !== 'chat') return []
    if (model.tool_call === false) return []
    const npm = model.provider?.npm ?? provider.npm
    const api = protocolOfNpm(npm)
    const baseURL = normalizeBaseURL(api, model.provider?.api ?? provider.api)
    const cost = modelsDevPrice(model.cost)
    const out: SourceModel = {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      ...model.family === undefined ? {} : { family: model.family },
      ...api === undefined ? {} : { api },
      ...baseURL === undefined ? {} : { baseURL },
      ...api === undefined && npm !== undefined ? { npm } : {},
      ...positiveInt(model.limit?.context) === undefined ? {} : { contextWindow: positiveInt(model.limit?.context) },
      ...positiveInt(model.limit?.output) === undefined ? {} : { maxTokens: positiveInt(model.limit?.output) },
      ...modalities(model.modalities?.input) === undefined ? {} : { input: modalities(model.modalities?.input) },
      reasoning: modelsDevReasoning(model),
      ...cost === undefined ? {} : { cost },
      ...model.release_date === undefined ? {} : { releaseDate: model.release_date },
      ...model.status === undefined ? {} : { status: model.status },
    }
    return [out]
  })
}

export interface ModelsDevDocument {
  providerIds: string[]
  provider(id: string): { name?: string; env?: string[]; api?: string; models: SourceModel[] } | undefined
  fetchedAt: number
  staleReason?: string
}

/**
 * Read models.dev. The returned document holds only the parsed object for the
 * duration of the caller's use; callers extract providers and drop it.
 */
export async function readModelsDev(cacheDir: string, options: { force?: boolean; maxAgeMs?: number; signal?: AbortSignal } = {}): Promise<ModelsDevDocument> {
  const doc = await cachedFetch(cacheDir, 'models-dev.json', MODELS_DEV_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal)
  const parsed = JSON.parse(doc.text) as Record<string, ModelsDevProvider>
  return {
    providerIds: Object.keys(parsed),
    provider: (id) => {
      const provider = parsed[id]
      if (provider === undefined) return undefined
      return {
        ...provider.name === undefined ? {} : { name: provider.name },
        ...provider.env === undefined ? {} : { env: provider.env },
        ...provider.api === undefined ? {} : { api: provider.api },
        models: normalizeModelsDevProvider(provider),
      }
    },
    fetchedAt: doc.fetchedAt,
    ...doc.staleReason === undefined ? {} : { staleReason: doc.staleReason },
  }
}

// ---------------------------------------------------------------------------
// OpenRouter
// ---------------------------------------------------------------------------

interface OpenRouterModel {
  id: string
  name?: string
  context_length?: number
  architecture?: { input_modalities?: string[]; output_modalities?: string[] }
  pricing?: Record<string, string | undefined>
  top_provider?: { context_length?: number | null; max_completion_tokens?: number | null }
  supported_parameters?: string[]
  endpoints?: string[]
  created?: number
}

function perMillion(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  // OpenRouter uses -1 for "variable" pricing (routers); treat as unknown.
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 1e6) / 1e6 : undefined
}

/** Normalize OpenRouter `/api/v1/models` entries. */
export function normalizeOpenRouter(data: OpenRouterModel[]): SourceModel[] {
  return data.flatMap((model) => {
    const params = model.supported_parameters ?? []
    if (!params.includes('tools')) return []
    if (model.architecture?.output_modalities !== undefined && !model.architecture.output_modalities.includes('text')) return []
    const input = perMillion(model.pricing?.prompt)
    const output = perMillion(model.pricing?.completion)
    const cacheRead = perMillion(model.pricing?.input_cache_read)
    const cacheWrite = perMillion(model.pricing?.input_cache_write)
    const contextWindow = positiveInt(model.top_provider?.context_length ?? undefined) ?? positiveInt(model.context_length)
    const maxTokens = positiveInt(model.top_provider?.max_completion_tokens ?? undefined)
    const out: SourceModel = {
      id: model.id,
      ...model.name === undefined ? {} : { name: model.name },
      api: 'openai-completions',
      baseURL: 'https://openrouter.ai/api/v1',
      ...contextWindow === undefined ? {} : { contextWindow },
      ...maxTokens === undefined ? {} : { maxTokens },
      ...modalities(model.architecture?.input_modalities) === undefined ? {} : { input: modalities(model.architecture?.input_modalities) },
      reasoning: params.includes('reasoning') || params.includes('reasoning_effort')
        ? { supported: true, kind: 'effort' }
        : { supported: false },
      ...input === undefined || output === undefined ? {} : {
        cost: {
          input,
          output,
          ...cacheRead === undefined ? {} : { cacheRead },
          ...cacheWrite === undefined ? {} : { cacheWrite },
        },
      },
      ...model.created === undefined ? {} : { releaseDate: new Date(model.created * 1000).toISOString().slice(0, 10) },
      ...model.endpoints === undefined ? {} : { endpoints: [...model.endpoints] },
    }
    return [out]
  })
}

export async function readOpenRouter(cacheDir: string, options: { force?: boolean; maxAgeMs?: number; signal?: AbortSignal } = {}): Promise<SourceSnapshot> {
  const doc = await cachedFetch(cacheDir, 'openrouter-models.json', OPENROUTER_MODELS_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal)
  const parsed = JSON.parse(doc.text) as { data?: OpenRouterModel[] }
  if (!Array.isArray(parsed.data)) throw new Error('OpenRouter model list has no data array')
  return {
    models: normalizeOpenRouter(parsed.data),
    fetchedAt: doc.fetchedAt,
    ...doc.staleReason === undefined ? {} : { staleReason: doc.staleReason },
  }
}
