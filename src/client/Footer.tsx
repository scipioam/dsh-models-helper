/** Models-page footer: bindings summary, check-all, cache status and refresh. */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import type { BindingDiff } from '../shared/rpc.ts'
import { Banner, fmtTime, sourceLabel, Styles, useStatus } from './ui.tsx'
import { defaultApplySelection } from './DiffPanel.tsx'

export function Footer(props: { api: HelperApi; t: Translate }): ReactElement {
  const { api, t } = props
  const { status, error, reload } = useStatus(api)
  const [results, setResults] = React.useState<BindingDiff[] | undefined>(undefined)
  const [busy, setBusy] = React.useState<string | undefined>(undefined)
  const [notice, setNotice] = React.useState<string | undefined>(undefined)
  const [actionError, setActionError] = React.useState<string | undefined>(undefined)

  const checkAll = async (): Promise<void> => {
    setBusy('check')
    setActionError(undefined)
    setNotice(undefined)
    const result = await api.call('binding.diff', {})
    setBusy(undefined)
    if (result.ok) {
      setResults(result.value.results)
      await reload()
    } else {
      setActionError(result.error.message)
    }
  }

  const applyDefaults = async (diff: BindingDiff): Promise<void> => {
    const selection = defaultApplySelection(diff)
    if (selection.length === 0) return
    setBusy(`apply:${diff.route}`)
    setActionError(undefined)
    const result = await api.call('binding.apply', { route: diff.route, revision: diff.revision, selection })
    setBusy(undefined)
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    setNotice(`${diff.route}: ${t('footer.applied')}`)
    setResults(previous => previous?.filter(row => row.route !== diff.route))
    await reload()
  }

  const refreshCache = async (): Promise<void> => {
    setBusy('cache')
    setActionError(undefined)
    setNotice(undefined)
    const result = await api.call('cache.refresh', {})
    setBusy(undefined)
    if (result.ok) {
      setNotice(result.value.online ? t('footer.refreshDone') : result.value.staleReason ?? t('footer.refreshDone'))
      await reload()
    } else {
      setActionError(result.error.message)
    }
  }

  const unbind = async (route: string): Promise<void> => {
    setBusy(`unbind:${route}`)
    const result = await api.call('binding.unbind', { route })
    setBusy(undefined)
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    setResults(previous => previous?.filter(row => row.route !== route))
    await reload()
  }

  const cacheLine = (source: string, entry: { fetchedAt?: string; checkedAt?: string; staleReason?: string } | undefined): ReactElement => (
    <li key={source}>
      <span className="dmh-mono">{source}</span>
      <span className="dmh-muted">
        {entry?.fetchedAt === undefined
          ? t('footer.cacheMissing')
          : t('footer.cacheValue', { fetched: fmtTime(entry.fetchedAt, t), checked: fmtTime(entry.checkedAt, t) })}
      </span>
      {entry?.staleReason === undefined ? null : <span className="dmh-warn">{t('footer.stale', { reason: entry.staleReason })}</span>}
    </li>
  )

  const bindings = status?.bindings ?? []
  const routeIds = new Set((status?.routes ?? []).map(route => route.id))
  const orphans = bindings.filter(binding => !routeIds.has(binding.route))

  return (
    <div className="dmh-panel" data-dmh-footer="">
      <Styles />
      <div className="dmh-row dmh-spread">
        <div className="dmh-row">
          <span className="dmh-title">{t('footer.title')}</span>
          <span className="dmh-badge">{t('footer.bindings', { count: bindings.length })}</span>
        </div>
        <div className="dmh-row">
          <button type="button" className="dmh-button dmh-button-primary" disabled={busy !== undefined || bindings.length === 0} onClick={() => { void checkAll() }}>
            {busy === 'check' ? t('footer.checking') : t('footer.checkAll')}
          </button>
        </div>
      </div>

      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
      {actionError === undefined ? null : <Banner kind="err">{t('error', { message: actionError })}</Banner>}
      {notice === undefined ? null : <Banner kind="ok">{notice}</Banner>}
      {bindings.length === 0 ? <div className="dmh-muted">{t('footer.none')}</div> : null}

      {bindings.length === 0 ? null : (
        <div>
          <div className="dmh-sub">{t('footer.bindingsTitle')}</div>
          <ul className="dmh-list">
            {bindings.map(binding => (
              <li key={binding.route}>
                <span className="dmh-mono">{binding.route}</span>
                <span className="dmh-muted">{sourceLabel(t, binding.source)}</span>
                <span className="dmh-muted">{binding.lastSync === undefined ? t('time.never') : t('time.lastSync', { time: fmtTime(binding.lastSync, t) })}</span>
                {routeIds.has(binding.route) ? null : (
                  <button type="button" className="dmh-button dmh-button-danger" disabled={busy !== undefined} onClick={() => { void unbind(binding.route) }}>
                    {t('footer.unbind')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {orphans.length === 0 ? null : <Banner kind="warn">{t('footer.orphans', { count: orphans.length })}</Banner>}
        </div>
      )}

      {results === undefined || results.length === 0 ? null : (
        <div>
          <div className="dmh-sub">{t('footer.results')}</div>
          <ul className="dmh-list">
            {results.map(diff => {
              const counts = diff.error === undefined
                ? `${t('diff.added', { count: diff.added.length })} · ${t('diff.updates', { count: diff.updates.length })} · ${t('diff.conflicts', { count: diff.conflicts.length })} · ${t('diff.removed', { count: diff.removed.length })}`
                : t('diff.error', { message: diff.error })
              const selection = defaultApplySelection(diff)
              return (
                <li key={diff.route} style={{ display: 'block' }}>
                  <div className="dmh-row">
                    <span className="dmh-mono">{diff.route}</span>
                    <span className="dmh-muted">{counts}</span>
                    {diff.online ? null : <span className="dmh-warn">{t('diff.stale', { time: fmtTime(diff.fetchedAt, t), reason: diff.staleReason ?? '' })}</span>}
                    <button type="button" className="dmh-button" disabled={busy !== undefined || selection.length === 0} onClick={() => { void applyDefaults(diff) }}>
                      {busy === `apply:${diff.route}` ? t('diff.applying') : t('footer.applyDefault')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="dmh-sep" />
      <div className="dmh-row dmh-spread">
        <span className="dmh-sub">{t('footer.cache')}</span>
        <button type="button" className="dmh-button" disabled={busy !== undefined} onClick={() => { void refreshCache() }}>
          {busy === 'cache' ? t('footer.refreshing') : t('footer.refresh')}
        </button>
      </div>
      <ul className="dmh-list">
        {cacheLine('models.dev', status?.cache.modelsDev)}
        {cacheLine('OpenRouter', status?.cache.openrouter)}
      </ul>
      <div className="dmh-hint">{t('footer.refreshHint')}</div>
    </div>
  )
}
