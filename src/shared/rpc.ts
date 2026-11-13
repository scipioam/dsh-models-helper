/**
 * Client ↔ Host RPC contract. One exact Fetch route carries every method; the
 * envelope is the Connection `client-request` / `server-response` pair so the
 * Client can use `ctx.connection.rpc.call('/api', RPC_ENDPOINT, …)`.
 */

/** Endpoint below `/api`; the Host registers `/api/<RPC_ENDPOINT>`. */
export const RPC_ENDPOINT = 'dsh-models-helper/rpc'

/** Package name; also the Client module id and locale namespace prefix. */
export const PACKAGE_NAME = 'dsh-models-helper'

/** Payload of one call. */
export interface RpcCall<M extends keyof RpcMethods = keyof RpcMethods> {
  method: M
  args: RpcMethods[M]['args']
}

/** Failure carried by the Connection result envelope. */
export interface RpcFailure {
  code: string
  message: string
  details: object
}

export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: RpcFailure }

// ---------------------------------------------------------------------------
// M0 probe methods
// ---------------------------------------------------------------------------

/** One step of a probe: what was checked, whether it worked, and detail. */
export interface ProbeCheck {
  id: string
  ok: boolean
  detail: string
  data?: unknown
}

/** Summary of one configured pi-ai route as the Host sees it. */
export interface RouteSummary {
  id: string
  declared: boolean | undefined
  apiKeyEnv: string | undefined
  api: string | undefined
  baseURL: string | undefined
  modelCount: number
}

export interface ProbeStatus {
  checks: ProbeCheck[]
  routes: RouteSummary[]
  llmPiAiRevision: number | undefined
  selfNs: string | undefined
  selfRevision: number | undefined
  piAiVersion: string | undefined
}

/** Template (installed pi-ai catalog) summary for one provider. */
export interface TemplateSummary {
  provider: string
  modelCount: number
  groups: { api: string; baseURL: string; count: number }[]
  sample: unknown
}

/** Source freshness summary for one provider. */
export interface SourceSummary {
  provider: string
  modelsDev: { ok: boolean; detail: string; count?: number; onlyInSource?: string[]; groups?: Record<string, number> }
  openrouter?: { ok: boolean; detail: string; count?: number; onlyInSource?: number }
}

export interface WriteTestResult {
  checks: ProbeCheck[]
}

export interface RpcMethods {
  'probe.status': { args: Record<string, never>; result: ProbeStatus }
  'probe.template': { args: { provider: string }; result: TemplateSummary }
  'probe.sources': { args: { provider: string }; result: SourceSummary }
  'probe.writeTest': { args: Record<string, never>; result: WriteTestResult }
}

export type RpcMethodName = keyof RpcMethods
