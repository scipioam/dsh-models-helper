/** Typed Client caller for the Host RPC route. */
import type { RpcMethodName, RpcMethods, RpcResult } from '../shared/rpc.ts'
import { RPC_ENDPOINT } from '../shared/rpc.ts'
import type { ClientConnection } from './dsh.ts'

export interface HelperApi {
  call<M extends RpcMethodName>(method: M, args: RpcMethods[M]['args'], signal?: AbortSignal): Promise<RpcResult<RpcMethods[M]['result']>>
}

export function createApi(connection: ClientConnection): HelperApi {
  return {
    async call(method, args, signal) {
      try {
        return await connection.rpc.call('/api', RPC_ENDPOINT, { method, args }, signal) as RpcResult<never>
      } catch (error) {
        // Transport failures (offline, 404 before installation completes) fold
        // into the error branch so views render them instead of crashing.
        return { ok: false, error: { code: 'models-helper/transport', message: error instanceof Error ? error.message : String(error), details: {} } }
      }
    },
  }
}
