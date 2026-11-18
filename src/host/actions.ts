/**
 * Action layer: every user operation (status, clone, bind, check, apply, lock,
 * cache, default model) is implemented once here on the Host. The Client only
 * renders state and calls these; M3's agent tools will reuse the same methods.
 *
 * Network policy (DESIGN §5.1/§9): checks and clone/bind plans always revalidate
 * the source online; a cached copy only answers when the network fails, and the
 * result carries the data's real fetch time plus the failure reason.
 */
import { join } from 'node:path'
import type { CredentialsService, HostContext, SettingsPathOp } from './dsh.ts'
import type {
  ApplyArgs,
  ApplyResult,
  BindOptions,
  BindSources,
  BindingDiff,
  BindingView,
  CacheRefreshResult,
  CloneApplyArgs,
  CloneApplyResult,
  ClonedRouteKey,
  CloneGroup,
  CloneGroupChoice,
  ClonePlan,
  DefaultModelUseArgs,
  DefaultModelUseResult,
  DiffArgs,
  DiffResult,
  HelperStatus,
  LockArgs,
  LockResult,
  ModelFieldName,
  PlannedModel,
  Price,
  Protocol,
  RouteInfo,
  SeparateKeyResult,
  SetAutoIncludeArgs,
  SourceRef,
  UnbindArgs,
} from '../shared/rpc.ts'
import { MODEL_FIELDS, deriveKeyRef } from '../shared/rpc.ts'
import { loadTemplateCatalog, type PiAiModel, type TemplateCatalog } from './pi-ai.ts'
import { normalizeBaseURL, readModelsDev, readOpenRouter, type SourceModel } from './sources.ts'
import { planGroup } from './merge.ts'
import { computeDiff, type ComputedDiff } from './diff.ts'
import { applySelection } from './apply.ts'
import type { Binding, ModelFields, PriceFile, RawModel, SnapshotFile } from './domain.ts'
import { definedFields, LLM_PI_AI_NS, lockKey, modelFieldsOf } from './domain.ts'
import {
  dataDir,
  descriptor,
  llmDescriptor,
  readBindings,
  readCacheStatus,
  readPriceFile,
  readPriceOverrides,
  readSnapshotFile,
  removeBinding,
  selfNamespace,
  writeBinding,
  writePriceFile,
  writeSnapshotFile,
} from './store.ts'
import { RpcError } from './rpc.ts'
import { overrideFor } from './prices.ts'
import { apiKeyEnvOf, effectiveConfig, effectiveProfile, isDeclared, routeDirectory, routeIds, userModels } from './routes.ts'
import { deepEqual, errorText, iso } from './util.ts'

const PROTOCOLS: readonly Protocol[] = ['anthropic-messages', 'openai-completions', 'openai-responses', 'google-generative-ai']
const PROTOCOL_SUFFIX: Record<Protocol, string> = {
  'anthropic-messages': 'anthropic',
  'openai-completions': 'chat',
  'openai-responses': 'responses',
  'google-generative-ai': 'gemini',
}
const PROTOCOL_LABEL: Record<Protocol, string> = {
  'anthropic-messages': 'Anthropic',
  'openai-completions': 'Chat',
  'openai-responses': 'Responses',
  'google-generative-ai': 'Gemini',
}
const AUTO_INCLUDE_LIMIT = 80
const SOURCE_MEMO_MS = 90_000
const CLONE_CACHE_MS = 15 * 60_000

function isProtocol(value: unknown): value is Protocol {
  return typeof value === 'string' && (PROTOCOLS as readonly string[]).includes(value)
}

function routeIdOk(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

function need<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new RpcError('models-helper/unavailable', message)
  return value
}

// ---------------------------------------------------------------------------
// Settings / route views
// ---------------------------------------------------------------------------

/** Resolve a credential reference to its current value, or undefined when absent/unreadable. */
async function resolveCredential(credentials: CredentialsService, ref: string): Promise<string | undefined> {
  try {
    const hit = await credentials.resolve(ref)
    return typeof hit?.value === 'string' && hit.value.length > 0 ? hit.value : undefined
  } catch {
    // A reference the seam cannot resolve (bad grammar, provider failure) is
    // treated like a missing key: the clone is created keyless and the UI asks
    // for one instead of failing the whole clone.
    return undefined
  }
}

function cacheDirOf(ctx: HostContext): string {
  return join(dataDir(ctx), 'cache')
}

/** Write a whole set of bindings in one mutate, retrying on revision churn. */
async function writeBindings(ctx: HostContext, bindings: readonly Binding[]): Promise<void> {
  const settings = ctx.get('settings')
  const ns = selfNamespace(ctx)
  if (settings === undefined || ns === undefined) throw new RpcError('models-helper/unavailable', 'the plugin settings namespace is unavailable')
  const ops: SettingsPathOp[] = bindings.map(binding => ({ op: 'set', path: ['bindings', binding.route], value: binding }))
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const current = descriptor(ctx, ns)
      await settings.mutate(ns, ops, current?.revision)
      return
    } catch (error) {
      lastError = error
      if (!/changed since it was read/.test(errorText(error))) throw error
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------

interface LoadedSource {
  source: SourceRef
  label: string
  models: SourceModel[]
  fetchedAt: number
  online: boolean
  staleReason?: string
}

const sourceMemo = new Map<string, { at: number; value: LoadedSource }>()

function sourceKey(source: SourceRef): string {
  return source.kind === 'openrouter' ? 'openrouter' : `models-dev:${source.provider}`
}

async function loadSource(
  ctx: HostContext,
  source: SourceRef,
  options: { force?: boolean; memo?: Map<string, LoadedSource>; signal?: AbortSignal } = {},
): Promise<LoadedSource> {
  const key = sourceKey(source)
  if (options.memo !== undefined && options.memo.has(key)) return options.memo.get(key) as LoadedSource
  const force = options.force === true
  if (!force) {
    const memo = sourceMemo.get(key)
    if (memo !== undefined && Date.now() - memo.at < SOURCE_MEMO_MS) return memo.value
  }
  const dir = cacheDirOf(ctx)
  let loaded: LoadedSource
  try {
    if (source.kind === 'openrouter') {
      const snapshot = await readOpenRouter(dir, { force, signal: options.signal })
      loaded = {
        source,
        label: 'OpenRouter API',
        models: snapshot.models.filter(model => model.api !== undefined && isProtocol(model.api)),
        fetchedAt: snapshot.fetchedAt,
        online: snapshot.online,
        ...snapshot.staleReason === undefined ? {} : { staleReason: snapshot.staleReason },
      }
    } else {
      const doc = await readModelsDev(dir, { force, signal: options.signal })
      const entry = doc.provider(source.provider)
      if (entry === undefined) {
        throw new RpcError('models-helper/source-missing', `models.dev 中没有供应商 "${source.provider}"`, { provider: source.provider })
      }
      loaded = {
        source,
        label: entry.name ?? source.provider,
        models: entry.models.filter(model => model.api !== undefined && isProtocol(model.api)),
        fetchedAt: doc.fetchedAt,
        online: doc.online,
        ...doc.staleReason === undefined ? {} : { staleReason: doc.staleReason },
      }
    }
  } catch (error) {
    if (error instanceof RpcError) throw error
    throw new RpcError('models-helper/source-failed', `获取来源数据失败：${errorText(error)}`)
  }
  sourceMemo.set(key, { at: Date.now(), value: loaded })
  options.memo?.set(key, loaded)
  return loaded
}

function groupSourceModels(models: readonly SourceModel[], api: Protocol, baseURL: string): SourceModel[] {
  const target = normalizeBaseURL(api, baseURL)
  return models.filter(model => model.api === api && normalizeBaseURL(api, model.baseURL) === target)
}

function groupTemplateModels(catalog: TemplateCatalog, template: string, api: Protocol, baseURL: string): PiAiModel[] {
  const target = normalizeBaseURL(api, baseURL)
  return catalog.models(template).filter(model => model.api === api && (model.baseUrl === undefined || normalizeBaseURL(api, model.baseUrl) === target))
}

async function tryCatalog(ctx: HostContext): Promise<TemplateCatalog | undefined> {
  try {
    return await loadTemplateCatalog(ctx)
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function bindingView(binding: Binding): BindingView {
  return {
    route: binding.route,
    source: binding.source,
    template: binding.template,
    api: binding.api,
    baseURL: binding.baseURL,
    autoIncludeNew: binding.autoIncludeNew,
    ...binding.lastSync === undefined ? {} : { lastSync: binding.lastSync },
    locked: [...binding.locks],
  }
}

export async function helperStatus(ctx: HostContext): Promise<HelperStatus> {
  const effective = effectiveConfig(ctx)
  const directory = routeDirectory(ctx)
  const bindings = readBindings(ctx)
  const ids = routeIds(ctx)
  const routes: RouteInfo[] = []
  const routeKeyEnv = new Map<string, string | undefined>()
  for (const id of ids) routeKeyEnv.set(id, apiKeyEnvOf(ctx, id))
  for (const id of ids) {
    const profile = effective.providers?.[id]
    const entry = directory.get(id)
    const binding = bindings[id]
    const keyEnv = routeKeyEnv.get(id)
    const declared = entry?.declared === true
    // Symmetric: a built-in route reports the clones sharing its key, and a
    // clone reports the built-in route (and any sibling clone) sharing it.
    const sharedKeyWith = keyEnv === undefined
      ? []
      : [...ids].filter(other => other !== id && routeKeyEnv.get(other) === keyEnv)
    routes.push({
      id,
      displayName: profile?.displayName ?? entry?.displayName ?? id,
      declared,
      ...keyEnv === undefined ? {} : { apiKeyEnv: keyEnv },
      ...typeof profile?.api === 'string' ? { api: profile.api } : {},
      ...typeof profile?.baseURL === 'string' ? { baseURL: profile.baseURL } : {},
      modelCount: Array.isArray(profile?.models) ? profile.models.length : 0,
      bound: binding !== undefined,
      ...binding === undefined ? {} : { binding: bindingView(binding) },
      ...sharedKeyWith.length > 0 ? { sharedKeyWith } : {},
    })
  }
  const catalog = await tryCatalog(ctx)
  const template: HelperStatus['template'] = catalog === undefined
    ? { error: '已安装的 pi-ai 目录不可用' }
    : { ...catalog.version === undefined ? {} : { version: catalog.version }, providers: catalog.providers() }
  let defaultSelection: HelperStatus['defaultSelection']
  try {
    const current = ctx.get('agentDefaultModel')?.currentSelection()
    if (current !== undefined) {
      defaultSelection = {
        provider: current.provider,
        model: current.model,
        ...current.reasoningEffort === undefined ? {} : { reasoningEffort: String(current.reasoningEffort) },
      }
    }
  } catch {
    // Default-model discovery is optional; its absence hides the switch prompt.
  }
  const llm = llmDescriptor(ctx)
  return {
    routes,
    bindings: Object.values(bindings).map(bindingView),
    template,
    ...defaultSelection === undefined ? {} : { defaultSelection },
    cache: await readCacheStatus(ctx),
    ...llm?.revision === undefined ? {} : { llmRevision: llm.revision },
  }
}

// ---------------------------------------------------------------------------
// Clone plan
// ---------------------------------------------------------------------------

interface DraftGroup {
  api: Protocol
  baseURL: string
  sourceModels: SourceModel[]
  templateModels: PiAiModel[]
}

interface CachedPlan {
  plan: ClonePlan
  source: LoadedSource
  originalDisplayName: string
  createdAt: number
}

const clonePlans = new Map<string, CachedPlan>()

function cloneCacheKey(provider: string, source: SourceRef): string {
  return `${provider}|${sourceKey(source)}`
}

function draftGroups(sourceModels: readonly SourceModel[], templateModels: readonly PiAiModel[]): { groups: DraftGroup[]; skipped: number } {
  const groups = new Map<string, DraftGroup>()
  let skipped = 0
  const add = (api: Protocol, baseURL: string | undefined): DraftGroup => {
    const normalized = normalizeBaseURL(api, baseURL ?? '') ?? ''
    const key = `${api}\u0000${normalized}`
    let group = groups.get(key)
    if (group === undefined) {
      group = { api, baseURL: normalized, sourceModels: [], templateModels: [] }
      groups.set(key, group)
    }
    return group
  }
  for (const model of sourceModels) {
    if (!isProtocol(model.api)) { skipped += 1; continue }
    add(model.api, model.baseURL).sourceModels.push(model)
  }
  for (const model of templateModels) {
    if (!isProtocol(model.api)) { skipped += 1; continue }
    add(model.api, model.baseUrl).templateModels.push(model)
  }
  return { groups: [...groups.values()], skipped }
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`
    if (!used.has(candidate)) return candidate
  }
  throw new RpcError('models-helper/route-id', `无法为 "${base}" 生成唯一的路由 id`)
}

export async function clonePlan(ctx: HostContext, args: { provider?: unknown; source?: unknown }): Promise<ClonePlan> {
  const provider = typeof args.provider === 'string' ? args.provider : ''
  if (!routeIdOk(provider)) throw new RpcError('models-helper/bad-request', 'provider 参数无效')
  const effective = effectiveConfig(ctx)
  if (effective.providers?.[provider] === undefined) throw new RpcError('models-helper/route-missing', `llm-pi-ai 中没有供应商 "${provider}"`)
  if (isDeclared(ctx, provider)) throw new RpcError('models-helper/not-builtin', `"${provider}" 是自定义供应商，不能克隆；请使用「绑定参数来源」`)
  const source: SourceRef = args.source === undefined || args.source === null
    ? { kind: 'models-dev', provider }
    : args.source as SourceRef
  if (source.kind !== 'models-dev' && source.kind !== 'openrouter') throw new RpcError('models-helper/bad-request', 'source 参数无效')
  if (source.kind === 'models-dev' && !routeIdOk(source.provider)) throw new RpcError('models-helper/bad-request', 'source.provider 参数无效')

  const catalog = await tryCatalog(ctx)
  if (catalog === undefined) throw new RpcError('models-helper/template-unavailable', '已安装的 pi-ai 目录不可用，无法读取模板')
  const templateModels = catalog.models(provider)
  if (templateModels.length === 0) throw new RpcError('models-helper/template-missing', `已安装目录中没有供应商 "${provider}"`)

  const loaded = await loadSource(ctx, source, { force: true })
  const drafted = draftGroups(loaded.models, templateModels)
  // A group the source cannot describe has no data to stay in sync with; the
  // template-only models in it are reported as skipped rather than cloned.
  const drafts = drafted.groups.filter(group => group.sourceModels.length > 0)
  const skipped = drafted.skipped + drafted.groups.length - drafts.length
  if (drafts.length === 0) throw new RpcError('models-helper/no-groups', '来源数据中没有可用的协议分组')

  const usedIds = new Set(Object.keys(effective.providers ?? {}))
  const groups: CloneGroup[] = drafts.map((draft) => {
    const plan = planGroup({ api: draft.api, sourceModels: draft.sourceModels, templateModels: draft.templateModels })
    const suffix = PROTOCOL_SUFFIX[draft.api]
    const suggestedId = uniqueId(`${provider}-${suffix}`, usedIds)
    usedIds.add(suggestedId)
    const displayName = effective.providers?.[provider]?.displayName ?? provider
    return {
      api: draft.api,
      baseURL: draft.baseURL,
      suggestedId,
      suggestedName: `${displayName} · ${PROTOCOL_LABEL[draft.api]}`,
      autoIncludeNew: draft.sourceModels.length <= AUTO_INCLUDE_LIMIT,
      routeCompat: plan.routeCompat,
      models: plan.models,
      withheldCompat: plan.withheldCompat,
      templateOnly: plan.templateOnly,
      noTemplate: plan.noTemplate,
    }
  })
  groups.sort((a, b) => (a.api === b.api ? a.baseURL.localeCompare(b.baseURL) : a.api.localeCompare(b.api)))
  const plan: ClonePlan = {
    provider,
    source,
    sourceName: loaded.label,
    fetchedAt: iso(loaded.fetchedAt),
    online: loaded.online,
    ...loaded.staleReason === undefined ? {} : { staleReason: loaded.staleReason },
    ...catalog.version === undefined ? {} : { templateVersion: catalog.version },
    groups,
    ...skipped > 0 ? { warnings: [`skipped-groups:${skipped}`] } : { warnings: [] },
  }
  clonePlans.set(cloneCacheKey(provider, source), {
    plan,
    source: loaded,
    originalDisplayName: effective.providers?.[provider]?.displayName ?? provider,
    createdAt: Date.now(),
  })
  return plan
}

export async function cloneApply(ctx: HostContext, args: CloneApplyArgs): Promise<CloneApplyResult> {
  if (typeof args.provider !== 'string' || !Array.isArray(args.groups)) throw new RpcError('models-helper/bad-request', '参数无效')
  const cached = clonePlans.get(cloneCacheKey(args.provider, args.source))
  if (cached === undefined || Date.now() - cached.createdAt > CLONE_CACHE_MS) {
    throw new RpcError('models-helper/plan-expired', '克隆计划已过期，请重新打开克隆向导')
  }
  if (args.groups.length === 0) throw new RpcError('models-helper/bad-request', '至少选择一个协议组')
  const settings = ctx.get('settings')
  const llm = llmDescriptor(ctx)
  if (settings === undefined || llm === undefined) throw new RpcError('models-helper/unavailable', 'settings 服务不可用')
  const existing = new Set(Object.keys(effectiveConfig(ctx).providers ?? {}))
  const usedIds = new Set<string>()
  const writes: { choice: CloneGroupChoice; group: CloneGroup; models: RawModel[] }[] = []
  for (const choice of args.groups) {
    const group = cached.plan.groups.find(candidate => candidate.api === choice.api && candidate.baseURL === choice.baseURL)
    if (group === undefined) throw new RpcError('models-helper/bad-request', '协议组与克隆计划不匹配，请重新打开向导')
    if (typeof choice.routeId !== 'string' || !routeIdOk(choice.routeId)) throw new RpcError('models-helper/bad-request', `路由 id 无效：${String(choice.routeId)}`)
    if (existing.has(choice.routeId) || usedIds.has(choice.routeId)) throw new RpcError('models-helper/route-exists', `路由 id 已存在：${choice.routeId}`)
    usedIds.add(choice.routeId)
    const wanted = new Set(Array.isArray(choice.modelIds) ? choice.modelIds.filter((id): id is string => typeof id === 'string') : [])
    const models = group.models.filter(model => wanted.has(model.id)).map(model => ({ id: model.id, ...definedFields(model.fields) }) as RawModel)
    if (models.length === 0) throw new RpcError('models-helper/bad-request', '每个协议组至少选择一个模型')
    writes.push({ choice, group, models })
  }

  // Each clone owns an independent credential reference. Copying the source
  // route's key is what keeps the clone usable after the source provider is
  // deleted or re-keyed (the Models page unsets a deleted route's reference).
  // Copy before writing config: a keyless route is recoverable from the UI,
  // while a route pointing at a missing reference is not distinguishable.
  const credentials = ctx.get('credentials')
  const sourceKey = credentials === undefined ? undefined : await resolveCredential(credentials, apiKeyEnvOf(ctx, args.provider) ?? '')
  const keys: ClonedRouteKey[] = []
  const copiedRefs: string[] = []
  for (const { choice } of writes) {
    const ref = deriveKeyRef(choice.routeId)
    if (credentials === undefined) {
      keys.push({ route: choice.routeId, ref, status: 'unavailable' })
      continue
    }
    if (sourceKey === undefined) {
      keys.push({ route: choice.routeId, ref, status: 'source-missing' })
      continue
    }
    try {
      await credentials.set(ref, sourceKey)
      copiedRefs.push(ref)
      keys.push({ route: choice.routeId, ref, status: 'copied' })
    } catch {
      keys.push({ route: choice.routeId, ref, status: 'copy-failed' })
    }
  }
  const keyByRoute = new Map(keys.map(key => [key.route, key]))
  const ops: SettingsPathOp[] = writes.map(({ choice, group, models }) => {
    const route: Record<string, unknown> = {
      displayName: typeof choice.displayName === 'string' && choice.displayName.trim().length > 0 ? choice.displayName.trim() : group.suggestedName,
      api: group.api,
      baseURL: group.baseURL,
      models,
    }
    const key = keyByRoute.get(choice.routeId)
    if (key?.status === 'copied') route.apiKeyEnv = key.ref
    if (Object.keys(group.routeCompat).length > 0) route.compat = group.routeCompat
    return { op: 'set', path: ['providers', choice.routeId], value: route }
  })
  try {
    await settings.mutate(LLM_PI_AI_NS, ops, llm.revision)
  } catch (error) {
    // The config write failed, so the copied keys belong to routes that do not
    // exist; remove them instead of leaving orphaned secrets behind.
    if (credentials !== undefined) {
      for (const ref of copiedRefs) await credentials.unset(ref).catch(() => undefined)
    }
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError('models-helper/revision', '模型配置已被其他窗口修改，请重新打开克隆向导', { reason: errorText(error) })
    }
    throw new RpcError('models-helper/write-failed', `写入 llm-pi-ai 失败：${errorText(error)}`)
  }

  const now = new Date().toISOString()
  const bindings: Binding[] = writes.map(({ choice, group }) => ({
    route: choice.routeId,
    source: cached.plan.source,
    template: args.provider,
    api: group.api,
    baseURL: group.baseURL,
    autoIncludeNew: choice.autoIncludeNew === true,
    ...cached.plan.online ? { lastSync: now } : {},
    locks: [],
    priceOverrides: {},
  }))
  await writeBindings(ctx, bindings)

  const snapshots = await readSnapshotFile(ctx)
  const prices = await readPriceFile(ctx)
  for (const { choice, group, models } of writes) {
    // Baseline only what was actually written: unselected plan models were
    // never on the route, and a snapshot entry for them would later read as a
    // model the user removed.
    const plannedById = new Map(group.models.map(model => [model.id, model]))
    const snapshotModels: Record<string, Partial<ModelFields>> = {}
    const priceModels: Record<string, Price> = {}
    for (const written of models) {
      const planned = plannedById.get(written.id)
      if (planned === undefined) continue
      snapshotModels[written.id] = definedFields(planned.fields) as Partial<ModelFields>
      if (planned.price !== undefined) priceModels[written.id] = planned.price
    }
    snapshots.routes[choice.routeId] = { at: now, models: snapshotModels }
    prices.routes[choice.routeId] = {
      fetchedAt: cached.plan.fetchedAt,
      online: cached.plan.online,
      ...cached.plan.staleReason === undefined ? {} : { staleReason: cached.plan.staleReason },
      models: priceModels,
    }
  }
  await writeSnapshotFile(ctx, snapshots)
  await writePriceFile(ctx, prices)

  const warnings: string[] = []
  const result: CloneApplyResult = { routes: writes.map(entry => entry.choice.routeId), keys, warnings }
  const selection = ctx.get('agentDefaultModel')?.currentSelection()
  if (selection !== undefined && selection.provider === args.provider) {
    const target = writes.find(entry => entry.group.models.some(model => model.id === selection.model))
    if (target !== undefined) {
      result.defaultSuggestion = {
        provider: target.choice.routeId,
        model: selection.model,
        ...selection.reasoningEffort === undefined ? {} : { reasoningEffort: String(selection.reasoningEffort) },
      }
    }
  }
  clonePlans.delete(cloneCacheKey(args.provider, args.source))
  return result
}

// ---------------------------------------------------------------------------
// Binding an existing custom route
// ---------------------------------------------------------------------------

export async function bindOptions(ctx: HostContext, args: { route?: unknown }): Promise<BindOptions> {
  const route = typeof args.route === 'string' ? args.route : ''
  if (!routeIdOk(route)) throw new RpcError('models-helper/bad-request', 'route 参数无效')
  const profile = effectiveProfile(ctx, route)
  if (profile === undefined) throw new RpcError('models-helper/route-missing', `llm-pi-ai 中没有供应商 "${route}"`)
  if (!isDeclared(ctx, route)) throw new RpcError('models-helper/not-declared', `"${route}" 是内置供应商；内置路由不支持绑定，请先克隆`)
  if (readBindings(ctx)[route] !== undefined) throw new RpcError('models-helper/already-bound', `"${route}" 已绑定参数来源`)
  const api = isProtocol(profile.api) ? profile.api : undefined
  const baseURL = typeof profile.baseURL === 'string' ? profile.baseURL : undefined
  if (api === undefined || baseURL === undefined) throw new RpcError('models-helper/not-declared', '该路由缺少 api 或 baseURL，无法匹配来源')

  const doc = await readModelsDev(cacheDirOf(ctx), { force: true })
  const sources: BindSources[] = []
  for (const providerId of doc.providerIds) {
    const entry = doc.provider(providerId)
    if (entry === undefined) continue
    const count = groupSourceModels(entry.models, api, baseURL).length
    if (count > 0) sources.push({ source: { kind: 'models-dev', provider: providerId }, label: entry.name ?? providerId, modelCount: count })
  }
  sources.sort((a, b) => b.modelCount - a.modelCount)
  if (api === 'openai-completions' && (baseURL.includes('openrouter.ai') || route === 'openrouter')) {
    const openrouter = await loadSource(ctx, { kind: 'openrouter' }, { force: false })
    const count = groupSourceModels(openrouter.models, api, baseURL).length
    if (count > 0) sources.unshift({ source: { kind: 'openrouter' }, label: 'OpenRouter API', modelCount: count })
  }
  if (sources.length === 0) throw new RpcError('models-helper/no-source', '没有找到与该路由协议组匹配的来源；请检查 api 与 baseURL')

  const catalog = await tryCatalog(ctx)
  const templates: string[] = []
  if (catalog !== undefined) {
    for (const providerId of catalog.providers()) {
      if (groupTemplateModels(catalog, providerId, api, baseURL).length > 0) templates.push(providerId)
    }
    if (templates.length === 0) {
      for (const providerId of catalog.providers()) {
        if (catalog.models(providerId).some(model => model.api === api)) templates.push(providerId)
      }
    }
  }
  return { route, api, baseURL, sources, templates }
}

export async function bindingBind(ctx: HostContext, args: { route?: unknown; option?: unknown }): Promise<{ binding: BindingView; diff: BindingDiff }> {
  const route = typeof args.route === 'string' ? args.route : ''
  const option = args.option as { source?: SourceRef; template?: string; api?: Protocol; baseURL?: string } | undefined
  if (!routeIdOk(route) || option === undefined) throw new RpcError('models-helper/bad-request', '参数无效')
  const profile = effectiveProfile(ctx, route)
  if (profile === undefined) throw new RpcError('models-helper/route-missing', `llm-pi-ai 中没有供应商 "${route}"`)
  if (!isDeclared(ctx, route)) throw new RpcError('models-helper/not-declared', '内置路由不支持绑定')
  if (readBindings(ctx)[route] !== undefined) throw new RpcError('models-helper/already-bound', '该路由已绑定参数来源')
  const api = isProtocol(option.api) ? option.api : undefined
  if (api === undefined || typeof option.baseURL !== 'string' || typeof option.template !== 'string') throw new RpcError('models-helper/bad-request', '绑定参数无效')
  if (profile.api !== undefined && profile.api !== api) throw new RpcError('models-helper/bad-request', '绑定的协议与路由的 api 不一致')

  const binding: Binding = {
    route,
    source: option.source as SourceRef,
    template: option.template,
    api,
    baseURL: option.baseURL,
    autoIncludeNew: false,
    locks: [],
    priceOverrides: {},
  }
  const checked = await checkBinding(ctx, binding, { force: false })
  binding.autoIncludeNew = checked.plan.models.length <= AUTO_INCLUDE_LIMIT
  await writeBinding(ctx, binding)
  recentDiffs.set(route, checked.context)
  await writePriceFile(ctx, checked.prices)
  return { binding: bindingView(binding), diff: checked.diff }
}

// ---------------------------------------------------------------------------
// Check update
// ---------------------------------------------------------------------------

interface DiffContext {
  binding: Binding
  desired: PlannedModel[]
  currentRaw: RawModel[]
  revision: number
  diff: ComputedDiff
}

const recentDiffs = new Map<string, DiffContext>()

interface CheckedBinding {
  plan: { models: PlannedModel[] }
  diff: BindingDiff
  context: DiffContext
  prices: PriceFile
}

async function checkBinding(
  ctx: HostContext,
  binding: Binding,
  options: { force?: boolean; memo?: Map<string, LoadedSource>; prices?: PriceFile; snapshot?: SnapshotFile; catalog?: TemplateCatalog | undefined },
): Promise<CheckedBinding> {
  const llm = llmDescriptor(ctx)
  if (llm === undefined) throw new RpcError('models-helper/unavailable', 'llm-pi-ai settings 不可用')
  const revision = llm.revision
  const base: BindingDiff = {
    route: binding.route,
    source: binding.source,
    template: binding.template,
    api: binding.api,
    baseURL: binding.baseURL,
    revision,
    fetchedAt: new Date().toISOString(),
    online: false,
    added: [],
    candidates: [],
    updates: [],
    conflicts: [],
    removed: [],
    priceChanges: [],
    locked: [...binding.locks],
  }
  const profile = effectiveProfile(ctx, binding.route)
  if (profile === undefined) {
    return {
      plan: { models: [] },
      diff: { ...base, error: '路由已不存在（可能已被删除）' },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} },
    }
  }
  let loaded: LoadedSource
  try {
    loaded = await loadSource(ctx, binding.source, { force: options.force !== false, ...options.memo === undefined ? {} : { memo: options.memo } })
  } catch (error) {
    return {
      plan: { models: [] },
      diff: { ...base, error: errorText(error) },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} },
    }
  }
  const sourceModels = groupSourceModels(loaded.models, binding.api, binding.baseURL)
  if (sourceModels.length === 0) {
    return {
      plan: { models: [] },
      diff: { ...base, fetchedAt: iso(loaded.fetchedAt), online: loaded.online, ...loaded.staleReason === undefined ? {} : { staleReason: loaded.staleReason }, error: '来源中没有与该协议组匹配的模型' },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} },
    }
  }
  const catalog = options.catalog ?? await tryCatalog(ctx)
  const templateModels = catalog === undefined ? [] : groupTemplateModels(catalog, binding.template, binding.api, binding.baseURL)
  const plan = planGroup({ api: binding.api, sourceModels, templateModels })
  if (catalog === undefined) base.warning = 'template-missing'

  const snapshot = options.snapshot ?? await readSnapshotFile(ctx)
  const prices = options.prices ?? await readPriceFile(ctx)
  const currentRaw = userModels(ctx, binding.route)
  const computed = computeDiff({
    desired: plan.models,
    current: currentRaw,
    snapshot: snapshot.routes[binding.route],
    locks: binding.locks,
    autoIncludeNew: binding.autoIncludeNew,
  })

  const oldPrices = prices.routes[binding.route]?.models ?? {}
  const overrides = readPriceOverrides(ctx)
  const nextPrices: Record<string, Price> = {}
  const priceChanges: BindingDiff['priceChanges'] = []
  for (const model of plan.models) {
    const price = model.price
    if (price === undefined) continue
    nextPrices[model.id] = price
    const old = oldPrices[model.id]
    if (old !== undefined && !deepEqual(old, price)) {
      priceChanges.push({ id: model.id, old, new: price, overridden: overrideFor(overrides, binding, binding.route, model.id) !== undefined })
    }
  }
  const nextPricesFile: PriceFile = {
    routes: {
      ...prices.routes,
      [binding.route]: {
        fetchedAt: iso(loaded.fetchedAt),
        online: loaded.online,
        ...loaded.staleReason === undefined ? {} : { staleReason: loaded.staleReason },
        models: nextPrices,
      },
    },
  }
  const diff: BindingDiff = {
    ...base,
    fetchedAt: iso(loaded.fetchedAt),
    online: loaded.online,
    ...loaded.staleReason === undefined ? {} : { staleReason: loaded.staleReason },
    added: computed.added,
    candidates: computed.candidates,
    updates: computed.updates,
    conflicts: computed.conflicts,
    removed: computed.removed,
    priceChanges,
  }
  const context: DiffContext = { binding, desired: plan.models, currentRaw, revision, diff: computed }
  if (loaded.online) {
    // "Last sync" only moves when the source was actually reached (DESIGN §5.1).
    binding.lastSync = new Date().toISOString()
    try {
      await writeBinding(ctx, binding)
    } catch (error) {
      ctx.logger.warn('models-helper: cannot record last sync for %s: %s', binding.route, errorText(error))
    }
  }
  return { plan, diff, context, prices: nextPricesFile }
}

export async function bindingDiff(ctx: HostContext, args: DiffArgs): Promise<DiffResult> {
  const bindings = readBindings(ctx)
  const routeFilter = typeof args.route === 'string' ? args.route : undefined
  if (routeFilter !== undefined && bindings[routeFilter] === undefined) {
    throw new RpcError('models-helper/not-bound', `"${routeFilter}" 尚未绑定参数来源`)
  }
  const routes = routeFilter === undefined ? Object.keys(bindings) : [routeFilter]
  const memo = new Map<string, LoadedSource>()
  const snapshot = await readSnapshotFile(ctx)
  const prices = await readPriceFile(ctx)
  const catalog = await tryCatalog(ctx)
  const results: BindingDiff[] = []
  for (const route of routes) {
    const binding = bindings[route]
    if (binding === undefined) continue
    const checked = await checkBinding(ctx, binding, { memo, snapshot, prices, catalog })
    if (checked.diff.error === undefined) {
      recentDiffs.set(route, checked.context)
      // Keep the in-memory price file in step for later routes in this run.
      const entry = checked.prices.routes[route]
      if (entry !== undefined) prices.routes[route] = entry
    }
    results.push(checked.diff)
  }
  await writePriceFile(ctx, prices)
  return { results }
}

// ---------------------------------------------------------------------------
// Apply a diff
// ---------------------------------------------------------------------------

const APPLY_FIELDS = new Set<ModelFieldName>(MODEL_FIELDS)

export async function bindingApply(ctx: HostContext, args: ApplyArgs): Promise<ApplyResult> {
  const route = typeof args.route === 'string' ? args.route : ''
  const context = recentDiffs.get(route)
  if (context === undefined) throw new RpcError('models-helper/refresh-required', '差异已失效，请重新检查更新')
  if (args.revision !== context.revision) throw new RpcError('models-helper/revision', '配置已被其他窗口修改，请重新检查更新')
  if (!Array.isArray(args.selection) || args.selection.length === 0) throw new RpcError('models-helper/bad-request', '没有选中要应用的项')
  const settings = ctx.get('settings')
  if (settings === undefined) throw new RpcError('models-helper/unavailable', 'settings 服务不可用')
  const models = applySelection(context.currentRaw, context.desired, args.selection)
  if (models.length === 0) throw new RpcError('models-helper/empty-route', '应用后路由将没有任何模型，已取消')

  try {
    await settings.mutate(LLM_PI_AI_NS, [{ op: 'set', path: ['providers', route, 'models'], value: models }], context.revision)
  } catch (error) {
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError('models-helper/revision', '配置已被其他窗口修改，请重新检查更新', { reason: errorText(error) })
    }
    throw new RpcError('models-helper/write-failed', `写入失败：${errorText(error)}`)
  }
  const now = new Date().toISOString()
  const snapshots = await readSnapshotFile(ctx)
  const snapshotModels: Record<string, Partial<ModelFields>> = {}
  for (const model of models) snapshotModels[model.id] = definedFields(modelFieldsOf(model)) as Partial<ModelFields>
  snapshots.routes[route] = { at: now, models: snapshotModels }
  await writeSnapshotFile(ctx, snapshots)
  recentDiffs.delete(route)
  const revision = llmDescriptor(ctx)?.revision ?? context.revision + 1
  return { route, changed: args.selection.length, revision }
}

// ---------------------------------------------------------------------------
// Locks / unbind / cache / default model
// ---------------------------------------------------------------------------

export async function bindingSetAutoInclude(ctx: HostContext, args: SetAutoIncludeArgs): Promise<BindingView> {
  const route = typeof args.route === 'string' ? args.route : ''
  const binding = readBindings(ctx)[route]
  if (binding === undefined) throw new RpcError('models-helper/not-bound', `"${route}" 尚未绑定更新来源`)
  if (typeof args.autoIncludeNew !== 'boolean') throw new RpcError('models-helper/bad-request', 'autoIncludeNew 参数无效')
  binding.autoIncludeNew = args.autoIncludeNew
  await writeBinding(ctx, binding)
  recentDiffs.delete(route)
  return bindingView(binding)
}

export async function bindingLock(ctx: HostContext, args: LockArgs): Promise<LockResult> {
  const route = typeof args.route === 'string' ? args.route : ''
  const bindings = readBindings(ctx)
  const binding = bindings[route]
  if (binding === undefined) throw new RpcError('models-helper/not-bound', `"${route}" 尚未绑定参数来源`)
  if (typeof args.model !== 'string' || !APPLY_FIELDS.has(args.field)) throw new RpcError('models-helper/bad-request', '锁参数无效')
  const key = lockKey(args.model, args.field)
  const locks = new Set(binding.locks)
  if (args.locked) locks.add(key)
  else locks.delete(key)
  binding.locks = [...locks].sort()
  await writeBinding(ctx, binding)
  recentDiffs.delete(route)
  return { locked: binding.locks }
}

export async function bindingUnbind(ctx: HostContext, args: UnbindArgs): Promise<Record<string, never>> {
  const route = typeof args.route === 'string' ? args.route : ''
  if (readBindings(ctx)[route] === undefined) throw new RpcError('models-helper/not-bound', `"${route}" 尚未绑定参数来源`)
  await removeBinding(ctx, route)
  const snapshots = await readSnapshotFile(ctx)
  delete snapshots.routes[route]
  await writeSnapshotFile(ctx, snapshots)
  const prices = await readPriceFile(ctx)
  delete prices.routes[route]
  await writePriceFile(ctx, prices)
  recentDiffs.delete(route)
  return {}
}

/**
 * Give one custom route its own credential reference. This repairs clones made
 * before cloning generated an independent key: their `apiKeyEnv` still names
 * the source provider's reference, so deleting or re-keying the source breaks
 * them. The current value is copied to the derived reference and the route's
 * `apiKeyEnv` is repointed in one settings write.
 */
export async function separateKey(ctx: HostContext, args: { route?: unknown }): Promise<SeparateKeyResult> {
  const route = typeof args.route === 'string' ? args.route : ''
  if (!routeIdOk(route)) throw new RpcError('models-helper/bad-request', 'route 参数无效')
  if (!isDeclared(ctx, route)) throw new RpcError('models-helper/not-declared', '只有自定义供应商才能拆分密钥引用')
  const settings = ctx.get('settings')
  const llm = llmDescriptor(ctx)
  const credentials = ctx.get('credentials')
  if (settings === undefined || llm === undefined) throw new RpcError('models-helper/unavailable', 'settings 服务不可用')
  if (credentials === undefined) throw new RpcError('models-helper/unavailable', 'credentials 服务不可用')
  const currentRef = apiKeyEnvOf(ctx, route)
  const targetRef = deriveKeyRef(route)
  if (currentRef === targetRef) return { ref: targetRef, copied: false }
  const value = currentRef === undefined ? undefined : await resolveCredential(credentials, currentRef)
  if (value === undefined) {
    throw new RpcError('models-helper/key-missing', `无法读取 ${currentRef ?? '当前'} 的密钥；请先在模型页为这个路由填写 API key`)
  }
  try {
    await credentials.set(targetRef, value)
  } catch (error) {
    throw new RpcError('models-helper/key-copy-failed', `复制密钥失败：${errorText(error)}`)
  }
  try {
    await settings.mutate(LLM_PI_AI_NS, [{ op: 'set', path: ['providers', route, 'apiKeyEnv'], value: targetRef }], llm.revision)
  } catch (error) {
    await credentials.unset(targetRef).catch(() => undefined)
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError('models-helper/revision', '模型配置已被其他窗口修改，请重试', { reason: errorText(error) })
    }
    throw new RpcError('models-helper/write-failed', `写入 llm-pi-ai 失败：${errorText(error)}`)
  }
  return { ref: targetRef, copied: true }
}

export async function cacheRefresh(ctx: HostContext): Promise<CacheRefreshResult> {
  const dir = cacheDirOf(ctx)
  const reasons: string[] = []
  let online = true
  try {
    const doc = await readModelsDev(dir, { force: true })
    if (!doc.online) { online = false; reasons.push(doc.staleReason ?? 'models.dev 未在线获取') }
  } catch (error) {
    online = false
    reasons.push(errorText(error))
  }
  try {
    const snapshot = await readOpenRouter(dir, { force: true })
    if (!snapshot.online) { online = false; reasons.push(snapshot.staleReason ?? 'OpenRouter 未在线获取') }
  } catch (error) {
    online = false
    reasons.push(errorText(error))
  }
  return {
    cache: await readCacheStatus(ctx),
    online,
    ...reasons.length === 0 ? {} : { staleReason: reasons.join('；') },
  }
}

export async function useDefaultModel(ctx: HostContext, args: DefaultModelUseArgs): Promise<DefaultModelUseResult> {
  const service = ctx.get('agentDefaultModel')
  if (service === undefined) throw new RpcError('models-helper/default-model-unavailable', 'agentDefaultModel 服务不可用')
  if (typeof args.provider !== 'string' || typeof args.model !== 'string') throw new RpcError('models-helper/bad-request', '参数无效')
  await service.saveSelection({
    provider: args.provider,
    model: args.model,
    ...args.reasoningEffort === undefined ? {} : { reasoningEffort: args.reasoningEffort },
  })
  return { applied: true }
}

