/**
 * One exact Fetch route below `/api` that speaks the Connection unary RPC
 * envelope, so the Client calls it with `ctx.connection.rpc.call()`.
 * Exact routes are owner-only: Connection answers 403 to every other Peer
 * before this handler runs.
 */
import type { HostConnection, Logger } from './dsh.ts'
import type { RpcFailure, RpcMethodName, RpcMethods } from '../shared/rpc.ts'
import { RPC_ENDPOINT } from '../shared/rpc.ts'

export type RpcHandlers = {
  [M in RpcMethodName]: (args: RpcMethods[M]['args'], signal: AbortSignal) => Promise<RpcMethods[M]['result']>
}

/** A failure with a stable code that crosses the wire unchanged. */
export class RpcError extends Error {
  constructor(readonly code: string, message: string, readonly details: object = {}) {
    super(message)
    this.name = 'RpcError'
  }
}

function failure(error: unknown): RpcFailure {
  if (error instanceof RpcError) return { code: error.code, message: error.message, details: error.details }
  const message = error instanceof Error ? error.message : String(error)
  return { code: 'models-helper/internal', message, details: {} }
}

function respond(rpcId: string, result: unknown): Response {
  return new Response(JSON.stringify({ type: 'server-response', rpcId, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Register the RPC route on Host Connection.
 * @returns the registration disposer.
 */
export function registerRpc(connection: HostConnection, handlers: RpcHandlers, logger: Logger): () => Promise<void> {
  return connection.fetch.register({
    path: `/api/${RPC_ENDPOINT}`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      let envelope: { type?: unknown; rpcId?: unknown; payload?: unknown }
      try {
        envelope = await request.json() as typeof envelope
      } catch {
        return new Response('invalid JSON', { status: 400 })
      }
      if (envelope.type !== 'client-request' || typeof envelope.rpcId !== 'string') {
        return new Response('invalid envelope', { status: 400 })
      }
      const rpcId = envelope.rpcId
      const payload = envelope.payload as { method?: unknown; args?: unknown } | undefined
      const method = payload?.method
      if (typeof method !== 'string' || !Object.hasOwn(handlers, method)) {
        return respond(rpcId, { ok: false, error: { code: 'models-helper/unknown-method', message: `unknown method ${String(method)}`, details: {} } })
      }
      const args = (typeof payload?.args === 'object' && payload.args !== null ? payload.args : {}) as never
      try {
        const handler = handlers[method as RpcMethodName] as (args: never, signal: AbortSignal) => Promise<unknown>
        const value = await handler(args, request.signal)
        return respond(rpcId, { ok: true, value: value ?? null })
      } catch (error) {
        if (!(error instanceof RpcError)) logger.warn('models-helper: %s failed: %s', method, error instanceof Error ? error.stack ?? error.message : String(error))
        return respond(rpcId, { ok: false, error: failure(error) })
      }
    },
  })
}
