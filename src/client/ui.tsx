/** Shared small view helpers: styles, status hook, formatting, badges. */
import type { ReactElement, ReactNode } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import type { RpcFailure } from '../shared/rpc.ts'
import { CSS } from './styles.ts'
import type { HelperStatus, ModelFieldName, Provenance, SourceRef } from '../shared/rpc.ts'
import { errorText } from './errors.ts'

export interface InjectedApi {
  api: HelperApi
}

export function Styles(): ReactElement {
  return <style>{CSS}</style>
}

/** One reloadable snapshot of `helper.status`, shared by the card and footer. */
interface StatusState {
  status?: HelperStatus
  error?: RpcFailure
  busy: boolean
}

// One shared snapshot for every card and the footer. A binding change in one
// card refreshes all of them, instead of leaving a stale footer until reload.
let statusState: StatusState = { busy: false }
const statusListeners = new Set<() => void>()
let statusInflight: Promise<void> | undefined

function publishStatus(next: StatusState): void {
  statusState = next
  for (const listener of statusListeners) listener()
}

async function loadStatus(api: HelperApi): Promise<void> {
  if (statusInflight !== undefined) return statusInflight
  publishStatus({ ...statusState, busy: true })
  const work = (async () => {
    const result = await api.call('helper.status', {})
    if (result.ok) publishStatus({ status: result.value, busy: false })
    else publishStatus({ ...statusState, error: result.error, busy: false })
  })()
  statusInflight = work
  try {
    await work
  } finally {
    statusInflight = undefined
  }
}

export function useStatus(api: HelperApi): { status?: HelperStatus; error?: RpcFailure; reload: () => Promise<void>; busy: boolean } {
  const [snapshot, setSnapshot] = React.useState<StatusState>(statusState)
  React.useEffect(() => {
    const listener = (): void => setSnapshot(statusState)
    statusListeners.add(listener)
    listener()
    if (statusState.status === undefined && statusState.error === undefined && !statusState.busy) {
      void loadStatus(api)
    }
    return () => { statusListeners.delete(listener) }
  }, [api])
  return { status: snapshot.status, error: snapshot.error, busy: snapshot.busy, reload: () => loadStatus(api) }
}

export function Banner({ kind, children }: { kind: 'ok' | 'warn' | 'err'; children: ReactNode }): ReactElement {
  const variant = kind === 'ok' ? ' dmh-banner-ok' : kind === 'err' ? ' dmh-banner-err' : ''
  return <div className={`dmh-banner${variant}`}>{children}</div>
}

export function fmtTime(value: string | undefined, t: Translate): string {
  if (value === undefined || value.length === 0) return t('time.unknown')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fieldLabel(t: Translate, field: ModelFieldName): string {
  return t(`field.${field}`)
}

/** Compact display of one field value inside a diff row. */
export function fieldText(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const text = JSON.stringify(value)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

export function sourceLabel(t: Translate, source: SourceRef): string {
  if (source.kind === 'openrouter') return t('source.openrouter')
  return `${t('source.models-dev')} · ${source.provider}`
}

export function ProvenanceBadge({ t, provenance }: { t: Translate; provenance: Provenance | undefined }): ReactElement | null {
  if (provenance === undefined || provenance === 'same') return null
  return <span className={`dmh-badge${provenance === 'inferred' ? ' dmh-badge-warn' : ''}`}>{t(`provenance.${provenance}`)}</span>
}

/** Reusable error banner that localizes a Host failure by code. */
export function Failure({ error, t }: { error: RpcFailure | undefined; t: Translate }): ReactElement | null {
  return error === undefined ? null : <Banner kind="err">{errorText(t, error)}</Banner>
}
