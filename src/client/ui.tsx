/** Shared small view helpers: styles, status hook, formatting, badges. */
import type { ReactElement, ReactNode } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import { CSS } from './styles.ts'
import type { HelperStatus, ModelFieldName, Provenance, SourceRef } from '../shared/rpc.ts'

export interface InjectedApi {
  api: HelperApi
}

export function Styles(): ReactElement {
  return <style>{CSS}</style>
}

/** One reloadable snapshot of `helper.status`, shared by the card and footer. */
export function useStatus(api: HelperApi): { status?: HelperStatus; error?: string; reload: () => Promise<void>; busy: boolean } {
  const [status, setStatus] = React.useState<HelperStatus | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [busy, setBusy] = React.useState(false)
  const reload = React.useCallback(async () => {
    setBusy(true)
    const result = await api.call('helper.status', {})
    setBusy(false)
    if (result.ok) {
      setStatus(result.value)
      setError(undefined)
    } else {
      setError(result.error.message)
    }
  }, [api])
  React.useEffect(() => { void reload() }, [reload])
  return { status, error, reload, busy }
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

/** Reusable busy/error banner pair. */
export function Failure({ message, t }: { message: string | undefined; t: Translate }): ReactElement | null {
  return message === undefined ? null : <Banner kind="err">{t('error', { message })}</Banner>
}
