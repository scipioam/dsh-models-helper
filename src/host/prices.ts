/**
 * Local price table (M2).
 *
 * Price lookup applies to every route, bound or not:
 * manual override (plugin Config) → source snapshot (clone/check update) →
 * installed catalog `cost` (offline fallback) → no price (renders `—`).
 * Rendering never fetches a source; this module only reads local state.
 */
import type { HostContext } from './dsh.ts'
import type {
  ModelPriceView,
  Price,
  PriceSource,
  PricesResult,
  RoutePricesView,
  SetPriceOverrideArgs,
  SetPriceOverrideResult,
} from '../shared/rpc.ts'
import type { Binding, PriceOverrides } from './domain.ts'
import { normalizePrice } from '../shared/cost.ts'
import { loadTemplateCatalog, type PiAiModel, type TemplateCatalog } from './pi-ai.ts'
import { RpcError } from './rpc.ts'
import { effectiveConfig, effectiveProfile, routeDirectory, routeIds } from './routes.ts'
import { readBindings, readPriceFile, readPriceOverrides, writePriceOverride } from './store.ts'

interface ModelRef {
  id: string
  name?: string
  template?: PiAiModel
}

/**
 * The override in force for one model: the plugin-wide override first, then
 * the binding's legacy `priceOverrides` entry (written before M2).
 */
export function overrideFor(
  overrides: PriceOverrides,
  binding: Binding | undefined,
  route: string,
  model: string,
): Price | undefined {
  return normalizePrice(overrides[route]?.[model]) ?? normalizePrice(binding?.priceOverrides?.[model])
}

/** Route models: configured list, else the installed catalog's provider, else snapshot keys. */
function modelRefs(
  ctx: HostContext,
  route: string,
  catalog: TemplateCatalog | undefined,
  template: string,
  snapshotModels: Record<string, Price>,
): ModelRef[] {
  const configured = effectiveProfile(ctx, route)?.models
  const refs: ModelRef[] = []
  const seen = new Set<string>()
  const push = (id: string, name: string | undefined, model: PiAiModel | undefined): void => {
    if (seen.has(id)) return
    seen.add(id)
    refs.push({ id, ...name === undefined ? {} : { name }, ...model === undefined ? {} : { template: model } })
  }
  if (Array.isArray(configured) && configured.length > 0) {
    for (const model of configured) {
      if (model === null || typeof model !== 'object' || typeof model.id !== 'string') continue
      push(model.id, typeof model.name === 'string' ? model.name : undefined, catalog?.findModel(template, model.id))
    }
    return refs
  }
  const installed = catalog?.models(route) ?? []
  if (installed.length > 0) {
    for (const model of installed) push(model.id, model.name, model)
    return refs
  }
  for (const id of Object.keys(snapshotModels)) push(id, undefined, catalog?.findModel(template, id))
  return refs
}

function resolved(
  route: string,
  ref: ModelRef,
  catalog: TemplateCatalog | undefined,
  override: Price | undefined,
  snapshotPrice: Price | undefined,
  snapshotFetchedAt: string | undefined,
  snapshotOnline: boolean | undefined,
  staleReason: string | undefined,
): ModelPriceView {
  let source: PriceSource = 'none'
  let price: Price | undefined
  if (override !== undefined) {
    source = 'override'
    price = override
  } else if (snapshotPrice !== undefined) {
    source = 'snapshot'
    price = snapshotPrice
  } else {
    const templatePrice = normalizePrice(ref.template?.cost)
      ?? normalizePrice(catalog?.findModelByAnyProvider(ref.id)?.cost)
    if (templatePrice !== undefined) {
      source = 'template'
      price = templatePrice
    }
  }
  const view: ModelPriceView = {
    id: ref.id,
    ...ref.name === undefined ? {} : { name: ref.name },
    ...price === undefined ? {} : { price },
    source,
  }
  // Snapshot metadata belongs only to a snapshot-sourced row; an override hides
  // the source price but the UI still shows when that snapshot was fetched.
  if (snapshotFetchedAt !== undefined && snapshotPrice !== undefined) view.fetchedAt = snapshotFetchedAt
  if (snapshotPrice !== undefined && snapshotOnline !== undefined) view.online = snapshotOnline
  if (snapshotPrice !== undefined && staleReason !== undefined) view.staleReason = staleReason
  return view
}

/** Build the local price table for every route the Models page knows. */
export async function pricesList(ctx: HostContext): Promise<PricesResult> {
  let catalog: TemplateCatalog | undefined
  try {
    catalog = await loadTemplateCatalog(ctx)
  } catch {
    catalog = undefined
  }
  const bindings = readBindings(ctx)
  const overrides = readPriceOverrides(ctx)
  const file = await readPriceFile(ctx)
  const directory = routeDirectory(ctx)
  // Only routes the user actually has: every installed catalog provider is
  // configurable, but pricing all of them would ship thousands of rows the
  // Models page never shows.
  const configured = new Set(Object.keys(effectiveConfig(ctx).providers ?? {}))
  const routes: RoutePricesView[] = []
  for (const route of routeIds(ctx).filter(id => configured.has(id) || bindings[id] !== undefined)) {
    const binding = bindings[route]
    const declared = directory.get(route)?.declared === true
    const snapshot = file.routes[route]
    const template = binding?.template ?? route
    const snapshotModels = snapshot?.models ?? {}
    const models = modelRefs(ctx, route, catalog, template, snapshotModels).map((ref) => {
      const snapshotFetchedAt = snapshot?.fetchedAt
      return resolved(
        route,
        ref,
        catalog,
        overrideFor(overrides, binding, route, ref.id),
        normalizePrice(snapshotModels[ref.id]),
        snapshotFetchedAt,
        snapshot?.online,
        snapshot?.staleReason,
      )
    })
    routes.push({
      route,
      displayName: effectiveProfile(ctx, route)?.displayName ?? directory.get(route)?.displayName ?? route,
      declared,
      bound: binding !== undefined,
      ...binding === undefined ? {} : { template: binding.template },
      ...snapshot === undefined ? {} : { fetchedAt: snapshot.fetchedAt, online: snapshot.online },
      ...snapshot?.staleReason === undefined ? {} : { staleReason: snapshot.staleReason },
      models,
    })
  }
  return { routes }
}

/** Set (or clear) a manual price override in the plugin Config. */
export async function setPriceOverride(ctx: HostContext, args: SetPriceOverrideArgs): Promise<SetPriceOverrideResult> {
  const route = typeof args.route === 'string' ? args.route : ''
  const model = typeof args.model === 'string' ? args.model : ''
  if (route.length === 0 || model.length === 0) throw new RpcError('models-helper/bad-request', '参数无效')
  if (!routeIds(ctx).includes(route)) throw new RpcError('models-helper/route-missing', `llm-pi-ai 中没有供应商 "${route}"`)
  if (args.price === null) {
    await writePriceOverride(ctx, route, model, null)
    return { route, model }
  }
  const price = normalizePrice(args.price)
  if (price === undefined) throw new RpcError('models-helper/bad-request', '价格无效：input/output 必须是非负数')
  await writePriceOverride(ctx, route, model, price)
  return { route, model, override: price }
}
