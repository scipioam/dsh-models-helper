/**
 * Merge engine (pure): SourceModel × installed pi-ai template → the model
 * fields a custom route should carry, plus which layer supplied each field.
 *
 * This is the only place thinking-level spellings, compat gates and
 * same-series inference are decided; the diff engine and the action layer
 * consume its output without re-deriving anything.
 */
import type { ModelFields, ModelFieldName, PlannedModel, Price, Provenance, Protocol } from '../shared/rpc.ts'
import type { PiAiModel } from './pi-ai.ts'
import type { SourceModel } from './sources.ts'
import { GEMINI_LEVELS, OFFERED_COMPAT, THINKING_LEVELS } from './domain.ts'
import { deepEqual } from './util.ts'

/** Filter a template model's compat down to the fields its protocol accepts. */
export function offeredCompat(compat: Record<string, unknown> | undefined, api: Protocol): Record<string, unknown> | undefined {
  if (compat === undefined) return undefined
  const offered = OFFERED_COMPAT[api]
  const out: Record<string, unknown> = {}
  for (const key of offered) {
    if (Object.hasOwn(compat, key) && compat[key] !== undefined) out[key] = compat[key]
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** True when `compat` contains a switch this protocol does not offer. */
export function hasWithheldCompat(compat: Record<string, unknown> | undefined, api: Protocol): boolean {
  if (compat === undefined) return false
  const offered = new Set(OFFERED_COMPAT[api])
  return Object.keys(compat).some(key => !offered.has(key))
}

/**
 * Route-level compat: switches every template model of the group declares with
 * the identical value, so hoisting them cannot change any model's behavior.
 */
export function routeCompatFor(templateModels: readonly PiAiModel[], api: Protocol): Record<string, unknown> {
  const offered = OFFERED_COMPAT[api]
  const out: Record<string, unknown> = {}
  if (templateModels.length === 0) return out
  for (const field of offered) {
    const first = templateModels[0]?.compat?.[field]
    if (first === undefined) continue
    if (templateModels.every(model => deepEqual(model.compat?.[field], first))) out[field] = first
  }
  return out
}

function hasNonOff(efforts: Record<string, string | null>): boolean {
  return Object.entries(efforts).some(([level, value]) => level !== 'off' && value !== null)
}

/** Apply the Gemini constraint: only level names may appear, values equal the key. */
function geminiEfforts(efforts: Record<string, string | null>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (Object.hasOwn(efforts, 'off') && efforts.off === null) out.off = null
  for (const level of GEMINI_LEVELS) {
    const value = efforts[level]
    if (value !== undefined && value === level) out[level] = value
  }
  return out
}

/**
 * Convert a pi-ai `thinkingLevelMap` to `reasoningEfforts`.
 *
 * An explicit value sends that string; `null` omits the level; an absent level
 * means "off sends nothing" and "minimal…high send their own name", while
 * xhigh/max stay unavailable (DESIGN §4).
 */
export function effortsFromThinkingLevelMap(
  map: Partial<Record<string, string | null>> | undefined,
  api: Protocol,
): Record<string, string | null> | false | undefined {
  if (map === undefined) return undefined
  const efforts: Record<string, string | null> = {}
  for (const level of THINKING_LEVELS) {
    if (Object.hasOwn(map, level)) {
      const value = map[level]
      if (value === null) {
        if (level === 'off') efforts.off = null
        continue
      }
      if (typeof value === 'string') efforts[level] = value
      continue
    }
    if (level === 'off') efforts.off = null
    else if (level === 'minimal' || level === 'low' || level === 'medium' || level === 'high') efforts[level] = level
  }
  const final = api === 'google-generative-ai' ? geminiEfforts(efforts) : efforts
  if (!hasNonOff(final)) return false
  return final
}

/**
 * Derive reasoning levels from the source when the template says nothing.
 * Returns the value and whether it is an inference (toggle/budget/default).
 */
export function effortsFromSource(
  reasoning: SourceModel['reasoning'] | undefined,
  api: Protocol,
): { value: Record<string, string | null> | false | undefined; inferred: boolean } {
  if (reasoning === undefined) return { value: undefined, inferred: false }
  if (!reasoning.supported) return { value: false, inferred: false }
  let efforts: Record<string, string | null>
  let inferred = false
  if (reasoning.kind === 'effort' && reasoning.efforts !== undefined && reasoning.efforts.length > 0) {
    efforts = {}
    for (const raw of reasoning.efforts) {
      if (raw === 'none') efforts.off = 'none'
      else if ((THINKING_LEVELS as readonly string[]).includes(raw)) efforts[raw] = raw
      // Unknown spellings are dropped; the clone plan reports them as warnings.
    }
    if (api === 'google-generative-ai') {
      const gemini = geminiEfforts(efforts)
      gemini.off = null
      efforts = gemini
    }
    if (!hasNonOff(efforts)) return { value: undefined, inferred: true }
  } else if (reasoning.kind === 'budget') {
    efforts = { off: null, low: 'low', medium: 'medium', high: 'high' }
    inferred = true
  } else {
    efforts = { off: null, high: 'high' }
    inferred = true
  }
  const final = api === 'google-generative-ai' ? geminiEfforts(efforts) : efforts
  return { value: hasNonOff(final) ? final : undefined, inferred }
}

/** Longest common prefix length, used for same-series inference. */
function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0
  while (index < limit && a[index] === b[index]) index += 1
  return index
}

/**
 * Template models that plausibly describe `id` and share its protocol group:
 * models.dev `family` first, then the longest shared id prefix (≥ 3 chars).
 */
export function sameSeries(id: string, family: string | undefined, templateModels: readonly PiAiModel[]): PiAiModel[] {
  if (family !== undefined && family.length > 0) {
    const needle = family.toLowerCase()
    const byFamily = templateModels.filter(model => {
      const hay = model.id.toLowerCase()
      return hay.includes(needle) || needle.includes(hay)
    })
    if (byFamily.length > 0) return byFamily
  }
  const ranked = templateModels
    .map(model => ({ model, length: commonPrefixLength(model.id, id) }))
    .filter(entry => entry.length >= 3)
  if (ranked.length === 0) return []
  const best = Math.max(...ranked.map(entry => entry.length))
  return ranked.filter(entry => entry.length === best).map(entry => entry.model)
}

/** Compat shared identically by every same-series template model. */
function inferredCompat(candidates: readonly PiAiModel[], api: Protocol): Record<string, unknown> | undefined {
  if (candidates.length === 0) return undefined
  const out: Record<string, unknown> = {}
  for (const field of OFFERED_COMPAT[api]) {
    if (!candidates.every(model => model.compat !== undefined && Object.hasOwn(model.compat, field))) continue
    const first = candidates[0]?.compat?.[field]
    if (candidates.every(model => deepEqual(model.compat?.[field], first))) out[field] = first
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function inputOf(value: string[] | undefined): ('text' | 'image')[] | undefined {
  if (value === undefined) return undefined
  const out = value.filter((kind): kind is 'text' | 'image' => kind === 'text' || kind === 'image')
  return out.length > 0 ? out : undefined
}

function removeRouteCompat(compat: Record<string, unknown> | undefined, routeCompat: Record<string, unknown>): Record<string, unknown> | undefined {
  if (compat === undefined) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(compat)) {
    if (deepEqual(routeCompat[key], value)) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Price for one model: source wins, template is the offline fallback. */
export function mergePrice(source: Price | undefined, template: Price | undefined): Price | undefined {
  if (source !== undefined) return source
  if (template !== undefined) return template
  return undefined
}

export interface GroupPlan {
  routeCompat: Record<string, unknown>
  models: PlannedModel[]
  /** Diagnostics the clone wizard shows as a one-line summary. */
  withheldCompat: number
  templateOnly: number
  noTemplate: number
}

/**
 * Plan every model of one protocol group.
 *
 * The union of source models and installed-template models is returned: source
 * additions are the point of the plugin, and template-only models keep working
 * (they show up as "removed from source" on later checks).
 */
export function planGroup(input: {
  api: Protocol
  sourceModels: readonly SourceModel[]
  templateModels: readonly PiAiModel[]
}): GroupPlan {
  const { api, sourceModels, templateModels } = input
  const routeCompat = routeCompatFor(templateModels, api)
  const sourceById = new Map(sourceModels.map(model => [model.id, model]))
  const templateById = new Map(templateModels.map(model => [model.id, model]))
  const ids: string[] = []
  for (const model of sourceModels) ids.push(model.id)
  for (const model of templateModels) if (!sourceById.has(model.id)) ids.push(model.id)

  const models: PlannedModel[] = []
  let withheldCompat = 0
  let templateOnly = 0
  let noTemplate = 0
  for (const id of ids) {
    const source = sourceById.get(id)
    const template = templateById.get(id)
    models.push(planModel({ id, source, template, templateModels, api, routeCompat }))
    if (template !== undefined && hasWithheldCompat(template.compat, api)) withheldCompat += 1
    if (source === undefined) templateOnly += 1
    if (source !== undefined && template === undefined) noTemplate += 1
  }
  return { routeCompat, models, withheldCompat, templateOnly, noTemplate }
}

function planModel(input: {
  id: string
  source: SourceModel | undefined
  template: PiAiModel | undefined
  templateModels: readonly PiAiModel[]
  api: Protocol
  routeCompat: Record<string, unknown>
}): PlannedModel {
  const { id, source, template, api, routeCompat } = input
  const fields: ModelFields = {}
  const provenance: Partial<Record<ModelFieldName, Provenance>> = {}

  if (source?.name !== undefined) { fields.name = source.name; provenance.name = 'source' }
  else if (template?.name !== undefined) { fields.name = template.name; provenance.name = 'template' }

  if (source?.contextWindow !== undefined) { fields.contextWindow = source.contextWindow; provenance.contextWindow = 'source' }
  else if (template?.contextWindow !== undefined) { fields.contextWindow = template.contextWindow; provenance.contextWindow = 'template' }

  if (source?.maxTokens !== undefined) { fields.maxTokens = source.maxTokens; provenance.maxTokens = 'source' }
  else if (template?.maxTokens !== undefined) { fields.maxTokens = template.maxTokens; provenance.maxTokens = 'template' }

  const modalities = inputOf(source?.input) ?? inputOf(template?.input)
  if (modalities !== undefined) { fields.input = modalities; provenance.input = source?.input !== undefined ? 'source' : 'template' }

  const fromTemplate = effortsFromThinkingLevelMap(template?.thinkingLevelMap, api)
  if (fromTemplate !== undefined) {
    fields.reasoningEfforts = fromTemplate
    provenance.reasoningEfforts = 'template'
  } else if (source?.reasoning !== undefined) {
    const derived = effortsFromSource(source.reasoning, api)
    if (derived.value !== undefined) {
      fields.reasoningEfforts = derived.value
      provenance.reasoningEfforts = derived.inferred ? 'inferred' : 'source'
    } else if (derived.inferred) {
      provenance.reasoningEfforts = 'inferred'
    }
  } else if (template?.reasoning === false) {
    fields.reasoningEfforts = false
    provenance.reasoningEfforts = 'template'
  }

  const compatFromTemplate = removeRouteCompat(offeredCompat(template?.compat, api), routeCompat)
  if (compatFromTemplate !== undefined) {
    fields.compat = compatFromTemplate
    provenance.compat = 'template'
  } else if (template === undefined) {
    const series = sameSeries(id, source?.family, input.templateModels)
    const inferred = removeRouteCompat(inferredCompat(series, api), routeCompat)
    if (inferred !== undefined) { fields.compat = inferred; provenance.compat = 'inferred' }
  }

  const price = mergePrice(source?.cost, template?.cost)
  return {
    id,
    inTemplate: template !== undefined,
    templateOnly: source === undefined,
    fields,
    provenance,
    ...price === undefined ? {} : { price },
  }
}
