/**
 * Persistence for plugin state.
 *
 * - Bindings (and price overrides/locks) live in the plugin's own volatile
 *   Config so they survive reinstalls and are edited through `settings.mutate`.
 * - Model-field snapshots and price snapshots are derived data: plain JSON
 *   files under the plugin data directory, written atomically.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CacheEntry, CacheStatus, Price } from '../shared/rpc.ts'
import type { HostContext, SettingsDescriptor } from './dsh.ts'
import type { Binding, PriceFile, PriceOverrides, SnapshotFile } from './domain.ts'
import { LLM_PI_AI_NS } from './domain.ts'
import { normalizePrice } from '../shared/cost.ts'
import { readCacheEntry } from './cache.ts'
import { iso } from './util.ts'

/** Plugin data directory: `<DSH home>/integrations/dsh-models-helper`. */
export function dataDir(ctx: HostContext): string {
  const home = ctx.get('profileContext')?.home
  if (home === undefined) throw new Error('profileContext service is unavailable')
  return `${home}/integrations/dsh-models-helper`
}

function cacheDir(ctx: HostContext): string {
  return join(dataDir(ctx), 'cache')
}

export function descriptor(ctx: HostContext, ns: string): SettingsDescriptor | undefined {
  return ctx.get('settings')?.describe().find(row => row.ns === ns)
}

export function llmDescriptor(ctx: HostContext): SettingsDescriptor | undefined {
  return descriptor(ctx, LLM_PI_AI_NS)
}

/** Loader entry id, which is also this plugin's settings namespace. */
export function selfNamespace(ctx: HostContext): string | undefined {
  return ctx.fiber.entry?.options.id
}

// ---------------------------------------------------------------------------
// Bindings (plugin Config)
// ---------------------------------------------------------------------------

function bindingsRecord(ctx: HostContext): Record<string, Binding> {
  const ns = selfNamespace(ctx)
  if (ns === undefined) return {}
  const value = descriptor(ctx, ns)?.value as { bindings?: Record<string, unknown> } | undefined
  const raw = value?.bindings
  if (raw === undefined || raw === null || typeof raw !== 'object') return {}
  const out: Record<string, Binding> = {}
  for (const [route, entry] of Object.entries(raw)) {
    const binding = normalizeBinding(route, entry)
    if (binding !== undefined) out[route] = binding
  }
  return out
}

/** Read every binding, keyed by route id. */
export function readBindings(ctx: HostContext): Record<string, Binding> {
  return bindingsRecord(ctx)
}

function normalizeBinding(route: string, value: unknown): Binding | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const raw = value as Partial<Binding> & { source?: unknown }
  const source = raw.source as Binding['source'] | undefined
  if (source === undefined || typeof source !== 'object') return undefined
  if (source.kind !== 'models-dev' && source.kind !== 'openrouter') return undefined
  if (source.kind === 'models-dev' && typeof (source as { provider?: unknown }).provider !== 'string') return undefined
  if (typeof raw.template !== 'string' || typeof raw.api !== 'string' || typeof raw.baseURL !== 'string') return undefined
  return {
    route,
    source,
    template: raw.template,
    api: raw.api as Binding['api'],
    baseURL: raw.baseURL,
    autoIncludeNew: raw.autoIncludeNew === true,
    ...raw.lastSync === undefined ? {} : { lastSync: raw.lastSync },
    locks: Array.isArray(raw.locks) ? raw.locks.filter((lock): lock is string => typeof lock === 'string') : [],
    priceOverrides: raw.priceOverrides !== undefined && typeof raw.priceOverrides === 'object' && raw.priceOverrides !== null
      ? raw.priceOverrides as Binding['priceOverrides']
      : {},
  }
}

/** Store one binding, retrying once if another writer moved the revision. */
export async function writeBinding(ctx: HostContext, binding: Binding): Promise<void> {
  const settings = ctx.get('settings')
  const ns = selfNamespace(ctx)
  if (settings === undefined || ns === undefined) throw new Error('the plugin settings namespace is unavailable')
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const current = descriptor(ctx, ns)
      await settings.mutate(ns, [{ op: 'set', path: ['bindings', binding.route], value: binding }], current?.revision)
      return
    } catch (error) {
      lastError = error
      if (!/changed since it was read/.test(error instanceof Error ? error.message : String(error))) throw error
    }
  }
  throw lastError
}

export async function removeBinding(ctx: HostContext, route: string): Promise<void> {
  const settings = ctx.get('settings')
  const ns = selfNamespace(ctx)
  if (settings === undefined || ns === undefined) throw new Error('the plugin settings namespace is unavailable')
  await settings.mutate(ns, [{ op: 'unset', path: ['bindings', route] }], descriptor(ctx, ns)?.revision)
}

// ---------------------------------------------------------------------------
// Price overrides (plugin Config)
// ---------------------------------------------------------------------------

/** Read normalized price overrides; malformed entries are ignored. */
export function readPriceOverrides(ctx: HostContext): PriceOverrides {
  const ns = selfNamespace(ctx)
  if (ns === undefined) return {}
  const value = descriptor(ctx, ns)?.value as { priceOverrides?: unknown } | undefined
  const raw = value?.priceOverrides
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PriceOverrides = {}
  for (const [route, models] of Object.entries(raw)) {
    if (models === null || typeof models !== 'object' || Array.isArray(models)) continue
    const perModel: Record<string, Price> = {}
    for (const [model, price] of Object.entries(models)) {
      const normalized = normalizePrice(price)
      if (normalized !== undefined) perModel[model] = normalized
    }
    if (Object.keys(perModel).length > 0) out[route] = perModel
  }
  return out
}

/**
 * Set or clear one model's manual price override in the plugin Config.
 * @param price - `null` removes the override.
 */
export async function writePriceOverride(ctx: HostContext, route: string, model: string, price: unknown | null): Promise<void> {
  const settings = ctx.get('settings')
  const ns = selfNamespace(ctx)
  if (settings === undefined || ns === undefined) throw new Error('the plugin settings namespace is unavailable')
  // Clearing the last model of a route removes the route object too, so the
  // profile patch does not accumulate empty maps.
  const remaining = { ...(readPriceOverrides(ctx)[route] ?? {}) }
  delete remaining[model]
  const op = price === null
    ? Object.keys(remaining).length === 0
      ? { op: 'unset' as const, path: ['priceOverrides', route] }
      : { op: 'unset' as const, path: ['priceOverrides', route, model] }
    : { op: 'set' as const, path: ['priceOverrides', route, model], value: price }
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await settings.mutate(ns, [op], descriptor(ctx, ns)?.revision)
      return
    } catch (error) {
      lastError = error
      if (!/changed since it was read/.test(error instanceof Error ? error.message : String(error))) throw error
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// JSON files
// ---------------------------------------------------------------------------

/** Serialize writes per file so two RPC calls cannot interleave a rename. */
const writeChains = new Map<string, Promise<unknown>>()

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const previous = writeChains.get(path) ?? Promise.resolve()
  const next = previous.then(async () => {
    await mkdir(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    await writeFile(temp, `${JSON.stringify(value)}\n`, 'utf8')
    await rename(temp, path)
  })
  writeChains.set(path, next.catch(() => undefined))
  await next
}

function snapshotPath(ctx: HostContext): string {
  return join(dataDir(ctx), 'snapshots.json')
}

function pricesPath(ctx: HostContext): string {
  return join(dataDir(ctx), 'prices.json')
}

export async function readSnapshotFile(ctx: HostContext): Promise<SnapshotFile> {
  return readJson<SnapshotFile>(snapshotPath(ctx), { routes: {} })
}

export async function writeSnapshotFile(ctx: HostContext, file: SnapshotFile): Promise<void> {
  await writeJson(snapshotPath(ctx), file)
}

export async function readPriceFile(ctx: HostContext): Promise<PriceFile> {
  return readJson<PriceFile>(pricesPath(ctx), { routes: {} })
}

export async function writePriceFile(ctx: HostContext, file: PriceFile): Promise<void> {
  await writeJson(pricesPath(ctx), file)
}

// ---------------------------------------------------------------------------
// Cache status (no network)
// ---------------------------------------------------------------------------

export async function readCacheStatus(ctx: HostContext): Promise<CacheStatus> {
  const dir = cacheDir(ctx)
  const [modelsDev, openrouter] = await Promise.all([
    readCacheEntry(dir, 'models-dev.json'),
    readCacheEntry(dir, 'openrouter-models.json'),
  ])
  return { modelsDev: modelsDev as CacheEntry, openrouter: openrouter as CacheEntry }
}

/** Data directory exists? Only used to keep diagnostics honest. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** ISO timestamp helper re-exported so action code does not import util twice. */
export { iso }
