/**
 * Stable RPC error codes. The Host throws these and the Client localizes them
 * by code, so English UI does not show the Host's Chinese diagnostic text.
 * The list is also the completeness check used by the locale test.
 */
export const RPC_ERROR_CODES = [
  'models-helper/already-bound',
  'models-helper/bad-request',
  'models-helper/default-model-unavailable',
  'models-helper/empty-route',
  'models-helper/internal',
  'models-helper/key-copy-failed',
  'models-helper/key-missing',
  'models-helper/no-groups',
  'models-helper/no-selection',
  'models-helper/no-source',
  'models-helper/not-bound',
  'models-helper/not-builtin',
  'models-helper/not-declared',
  'models-helper/plan-expired',
  'models-helper/refresh-required',
  'models-helper/revision',
  'models-helper/route-exists',
  'models-helper/route-id',
  'models-helper/route-missing',
  'models-helper/selection-invalid',
  'models-helper/source-failed',
  'models-helper/source-missing',
  'models-helper/template-missing',
  'models-helper/template-unavailable',
  'models-helper/transport',
  'models-helper/unavailable',
  'models-helper/unknown-method',
  'models-helper/write-failed',
] as const

export type RpcErrorCode = typeof RPC_ERROR_CODES[number]

const CODE_SET: ReadonlySet<string> = new Set(RPC_ERROR_CODES)

/** Whether a wire code is one this plugin declares. */
export function isRpcErrorCode(code: string): code is RpcErrorCode {
  return CODE_SET.has(code)
}

/** Locale key suffix for a code (`models-helper/not-bound` → `not-bound`). */
export function errorCodeKey(code: string): string {
  return code.startsWith('models-helper/') ? code.slice('models-helper/'.length) : code
}
