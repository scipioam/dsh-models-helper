/**
 * Localized display of an RPC failure. The Host writes Chinese diagnostics for
 * logs and the Chinese UI; the Client shows a stable-code message instead so
 * an English locale never surfaces Host Chinese.
 */
import type { RpcFailure } from '../shared/rpc.ts'
import { errorCodeKey, isRpcErrorCode } from '../shared/errors.ts'
import type { Translate } from './dsh.ts'

export function errorText(t: Translate, failure: RpcFailure): string {
  if (!isRpcErrorCode(failure.code)) return t('errorCode.generic', { code: failure.code })
  const key = `errorCode.${errorCodeKey(failure.code)}`
  const text = t(key)
  return text === key ? t('errorCode.generic', { code: failure.code }) : text
}

/** Localize the failure a check-update result carries instead of its Host message. */
export function diffErrorText(t: Translate, diff: { error?: string; errorCode?: string }): string {
  if (diff.errorCode !== undefined) {
    return errorText(t, { code: diff.errorCode, message: diff.error ?? '', details: {} })
  }
  return t('diff.error', { message: diff.error ?? '' })
}
