/**
 * Client-side local price table: one shared in-memory snapshot that every
 * estimate reads. Loading and refreshing are Host RPC calls (no network);
 * editing an override refreshes it so all visible estimates re-price at once.
 */
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { PricesResult } from '../shared/rpc.ts'

export interface PriceTableState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  table?: PricesResult
  error?: string
}

let current: PriceTableState = { status: 'idle' }
const listeners = new Set<() => void>()
let inflight: Promise<void> | undefined

function publish(next: PriceTableState): void {
  current = next
  for (const listener of listeners) listener()
}

export function priceTableSnapshot(): PriceTableState {
  return current
}

export function subscribePriceTable(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Fetch the table once; `force` re-reads after an override write or a binding
 * change. Concurrent callers share one in-flight request.
 */
export async function loadPrices(api: HelperApi, force = false): Promise<void> {
  if (inflight !== undefined) return inflight
  if (!force && (current.status === 'ready' || current.status === 'loading')) return
  publish({ ...current, status: 'loading' })
  inflight = (async () => {
    const result = await api.call('prices.list', {})
    if (result.ok) publish({ status: 'ready', table: result.value })
    else publish({ status: 'error', error: result.error.message })
  })()
  try {
    await inflight
  } finally {
    inflight = undefined
  }
}

/** Write one override (`null` clears it) and refresh every estimate. */
export async function savePriceOverride(
  api: HelperApi,
  route: string,
  model: string,
  price: { input: number; output: number; cacheRead?: number; cacheWrite?: number } | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await api.call('prices.setOverride', { route, model, price })
  if (!result.ok) return { ok: false, message: result.error.message }
  await loadPrices(api, true)
  return { ok: true }
}

/** Subscribe a component to the shared table and ensure it is loaded. */
export function usePriceTable(api: HelperApi): PriceTableState {
  const [snapshot, setSnapshot] = React.useState<PriceTableState>(current)
  React.useEffect(() => {
    setSnapshot(current)
    const unsubscribe = subscribePriceTable(() => setSnapshot(current))
    void loadPrices(api)
    return unsubscribe
  }, [api])
  return snapshot
}
