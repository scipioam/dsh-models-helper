/**
 * M0 technical probes: each answers one feasibility question from the design
 * (template access, settings reads and writes, source freshness) against the
 * running Harness, and reports what it saw instead of assuming.
 */
import type { HostContext, SettingsDescriptor } from './dsh.ts'
import { loadTemplateCatalog, locateLlmPiAi, type PiAiModel } from './pi-ai.ts'
import { readModelsDev, readOpenRouter } from './sources.ts'
import type { ProbeCheck, ProbeStatus, RouteSummary, SourceSummary, TemplateSummary, WriteTestResult } from '../shared/rpc.ts'

export const LLM_PI_AI_NS = 'llm-pi-ai'
const PROBE_ROUTE = 'models-helper-probe'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function descriptor(ctx: HostContext, ns: string): SettingsDescriptor | undefined {
  return ctx.get('settings')?.describe().find(row => row.ns === ns)
}

interface ProfileShape {
  apiKeyEnv?: string
  api?: string
  baseURL?: string
  models?: unknown[]
}

function routesOf(ctx: HostContext, value: unknown): RouteSummary[] {
  const providers = (value as { providers?: Record<string, ProfileShape> } | undefined)?.providers ?? {}
  const directory = new Map((ctx.get('llm')?.listConfigurableProviders() ?? [])
    .filter(entry => entry.settingsNs === LLM_PI_AI_NS)
    .map(entry => [entry.provider, entry]))
  return Object.entries(providers).map(([id, profile]) => ({
    id,
    declared: directory.get(id)?.declared,
    apiKeyEnv: profile.apiKeyEnv,
    api: profile.api,
    baseURL: profile.baseURL,
    modelCount: Array.isArray(profile.models) ? profile.models.length : 0,
  }))
}

/** Plugin data directory: `<DSH home>/integrations/dsh-models-helper`. */
export function dataDir(ctx: HostContext): string {
  const home = ctx.get('profileContext')?.home
  if (home === undefined) throw new Error('profileContext service is unavailable')
  return `${home}/integrations/dsh-models-helper`
}

export async function probeStatus(ctx: HostContext): Promise<ProbeStatus> {
  const checks: ProbeCheck[] = []
  const services = ['settings', 'configEditor', 'pluginPackages', 'connection', 'llm', 'profileContext']
  const missing = services.filter(name => ctx.get(name) === undefined)
  checks.push({ id: 'services', ok: missing.length === 0, detail: missing.length === 0 ? services.join(', ') : `missing: ${missing.join(', ')}` })

  const profile = ctx.get('profileContext')
  checks.push({ id: 'dataDir', ok: profile !== undefined, detail: profile === undefined ? 'no profileContext' : `${dataDir(ctx)} (profile ${profile.name})` })

  try {
    checks.push({ id: 'llmPiAiPackage', ok: true, detail: locateLlmPiAi(ctx) })
  } catch (error) {
    checks.push({ id: 'llmPiAiPackage', ok: false, detail: errorText(error) })
  }

  let piAiVersion: string | undefined
  try {
    const catalog = await loadTemplateCatalog(ctx)
    piAiVersion = catalog.version
    const providers = catalog.providers()
    checks.push({ id: 'template', ok: providers.length > 0, detail: `pi-ai ${catalog.version ?? '?'} · ${providers.length} providers · ${catalog.location}` })
  } catch (error) {
    checks.push({ id: 'template', ok: false, detail: errorText(error) })
  }

  const llm = descriptor(ctx, LLM_PI_AI_NS)
  const routes = llm === undefined ? [] : routesOf(ctx, llm.value)
  checks.push({
    id: 'settingsRead',
    ok: llm !== undefined,
    detail: llm === undefined ? `settings has no "${LLM_PI_AI_NS}" namespace` : `revision ${llm.revision} · ${routes.length} routes`,
  })

  const selfNs = ctx.fiber.entry?.options.id
  const self = selfNs === undefined ? undefined : descriptor(ctx, selfNs)
  checks.push({
    id: 'selfSettings',
    ok: self !== undefined,
    detail: selfNs === undefined ? 'this plugin has no Loader entry' : self === undefined ? `namespace "${selfNs}" not listed by settings` : `namespace "${selfNs}" revision ${self.revision}`,
  })

  return {
    checks,
    routes,
    llmPiAiRevision: llm?.revision,
    selfNs,
    selfRevision: self?.revision,
    piAiVersion,
  }
}

export async function probeTemplate(ctx: HostContext, provider: string): Promise<TemplateSummary> {
  const catalog = await loadTemplateCatalog(ctx)
  const models = catalog.models(provider)
  const groups = new Map<string, { api: string; baseURL: string; count: number }>()
  for (const model of models) {
    const key = `${model.api} ${model.baseUrl ?? ''}`
    const group = groups.get(key) ?? { api: model.api, baseURL: model.baseUrl ?? '', count: 0 }
    group.count += 1
    groups.set(key, group)
  }
  const sample: PiAiModel | undefined = models.find(model => model.compat !== undefined && Object.keys(model.compat).length > 0) ?? models[0]
  return {
    provider,
    modelCount: models.length,
    groups: [...groups.values()],
    sample: sample === undefined ? null : {
      id: sample.id,
      api: sample.api,
      compat: sample.compat ?? null,
      thinkingLevelMap: sample.thinkingLevelMap ?? null,
      cost: sample.cost ?? null,
    },
  }
}

export async function probeSources(ctx: HostContext, provider: string, signal: AbortSignal): Promise<SourceSummary> {
  const dir = `${dataDir(ctx)}/cache`
  let templateIds = new Set<string>()
  try {
    templateIds = new Set((await loadTemplateCatalog(ctx)).models(provider).map(model => model.id))
  } catch {
    // Template failures are reported by probe.status.
  }
  const summary: SourceSummary = { provider, modelsDev: { ok: false, detail: '' } }
  try {
    const doc = await readModelsDev(dir, { signal })
    const entry = doc.provider(provider)
    if (entry === undefined) {
      summary.modelsDev = { ok: false, detail: `models.dev has no provider "${provider}" (${doc.providerIds.length} providers)` }
    } else {
      const groups: Record<string, number> = {}
      for (const model of entry.models) {
        const key = `${model.api ?? `unsupported:${model.npm ?? '?'}`} ${model.baseURL ?? ''}`
        groups[key] = (groups[key] ?? 0) + 1
      }
      summary.modelsDev = {
        ok: true,
        detail: `fetched ${new Date(doc.fetchedAt).toISOString()}${doc.staleReason === undefined ? '' : ` (stale: ${doc.staleReason})`}`,
        count: entry.models.length,
        onlyInSource: entry.models.map(model => model.id).filter(id => !templateIds.has(id)),
        groups,
      }
    }
  } catch (error) {
    summary.modelsDev = { ok: false, detail: errorText(error) }
  }
  if (provider === 'openrouter') {
    try {
      const snapshot = await readOpenRouter(dir, { signal })
      summary.openrouter = {
        ok: true,
        detail: `fetched ${new Date(snapshot.fetchedAt).toISOString()}${snapshot.staleReason === undefined ? '' : ` (stale: ${snapshot.staleReason})`}`,
        count: snapshot.models.length,
        onlyInSource: snapshot.models.filter(model => !templateIds.has(model.id)).length,
      }
    } catch (error) {
      summary.openrouter = { ok: false, detail: errorText(error) }
    }
  }
  return summary
}

/**
 * Exercise the write path end to end and leave no trace: add a throwaway
 * route to llm-pi-ai, prove a stale revision is refused, remove the route;
 * then set and unset one field of this plugin's own namespace.
 */
export async function probeWriteTest(ctx: HostContext): Promise<WriteTestResult> {
  const checks: ProbeCheck[] = []
  const settings = ctx.get('settings')
  if (settings === undefined) return { checks: [{ id: 'settings', ok: false, detail: 'settings service is unavailable' }] }

  const start = descriptor(ctx, LLM_PI_AI_NS)
  if (start === undefined) return { checks: [{ id: 'settings', ok: false, detail: `no "${LLM_PI_AI_NS}" namespace` }] }
  const existing = (start.value as { providers?: Record<string, unknown> }).providers ?? {}
  if (Object.hasOwn(existing, PROBE_ROUTE)) {
    return { checks: [{ id: 'precondition', ok: false, detail: `route "${PROBE_ROUTE}" already exists; remove it first` }] }
  }

  let added = false
  try {
    await settings.mutate(LLM_PI_AI_NS, [{
      op: 'set',
      path: ['providers', PROBE_ROUTE],
      value: {
        displayName: 'Models helper probe',
        api: 'openai-completions',
        baseURL: 'https://example.invalid/v1',
        compat: { supportsDeveloperRole: false, maxTokensField: 'max_tokens' },
        models: [{ id: 'probe-model', contextWindow: 32768, maxTokens: 4096, input: ['text'], reasoningEfforts: { off: null, high: 'high' } }],
      },
    }], start.revision)
    added = true
    const after = descriptor(ctx, LLM_PI_AI_NS)
    const route = (after?.value as { providers?: Record<string, ProfileShape> } | undefined)?.providers?.[PROBE_ROUTE]
    checks.push({
      id: 'addRoute',
      ok: route !== undefined,
      detail: `revision ${start.revision} → ${after?.revision ?? '?'}; stored ${JSON.stringify(route ?? null)}`,
    })
    const listed = ctx.get('llm')?.listConfigurableProviders().find(entry => entry.provider === PROBE_ROUTE)
    checks.push({ id: 'routeRegistered', ok: listed !== undefined, detail: listed === undefined ? 'not in the configurable-provider directory' : `declared=${String(listed.declared)}` })
    try {
      await settings.mutate(LLM_PI_AI_NS, [{ op: 'set', path: ['providers', PROBE_ROUTE, 'displayName'], value: 'stale' }], start.revision)
      checks.push({ id: 'staleRevisionRefused', ok: false, detail: 'a write with a stale revision was accepted' })
    } catch (error) {
      checks.push({ id: 'staleRevisionRefused', ok: /changed since it was read/.test(errorText(error)), detail: errorText(error) })
    }
  } catch (error) {
    checks.push({ id: 'addRoute', ok: false, detail: errorText(error) })
  } finally {
    if (added) {
      try {
        const current = descriptor(ctx, LLM_PI_AI_NS)
        await settings.mutate(LLM_PI_AI_NS, [{ op: 'unset', path: ['providers', PROBE_ROUTE] }], current?.revision)
        const after = descriptor(ctx, LLM_PI_AI_NS)
        const gone = !Object.hasOwn((after?.value as { providers?: object } | undefined)?.providers ?? {}, PROBE_ROUTE)
        checks.push({ id: 'removeRoute', ok: gone, detail: gone ? `revision → ${after?.revision ?? '?'}` : 'route still present' })
      } catch (error) {
        checks.push({ id: 'removeRoute', ok: false, detail: errorText(error) })
      }
    }
  }

  const selfNs = ctx.fiber.entry?.options.id
  if (selfNs === undefined) {
    checks.push({ id: 'selfWrite', ok: false, detail: 'this plugin has no Loader entry' })
  } else {
    try {
      const stamp = new Date().toISOString()
      await settings.mutate(selfNs, [{ op: 'set', path: ['probe', 'lastWriteTest'], value: stamp }], descriptor(ctx, selfNs)?.revision)
      const stored = (descriptor(ctx, selfNs)?.value as { probe?: { lastWriteTest?: string } } | undefined)?.probe?.lastWriteTest
      await settings.mutate(selfNs, [{ op: 'unset', path: ['probe'] }], descriptor(ctx, selfNs)?.revision)
      checks.push({ id: 'selfWrite', ok: stored === stamp, detail: stored === stamp ? 'set and unset own volatile field' : `read back ${String(stored)}` })
    } catch (error) {
      checks.push({ id: 'selfWrite', ok: false, detail: errorText(error) })
    }
  }
  return { checks }
}
