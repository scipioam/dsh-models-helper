/** M0 probe views: one panel inside each pi-ai provider card, one in the Models footer. */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { ProviderCardOwnerProps, Translate } from './dsh.ts'
import type { ProbeCheck, ProbeStatus, SourceSummary, TemplateSummary } from '../shared/rpc.ts'
import { CSS } from './styles.ts'

export interface InjectedApi {
  api: HelperApi
}

function Styles(): ReactElement {
  return <style>{CSS}</style>
}

function CheckList({ checks, t }: { checks: ProbeCheck[]; t: Translate }): ReactElement {
  return (
    <ul className="dmh-list">
      {checks.map(check => (
        <li key={check.id}>
          <span className={check.ok ? 'dmh-ok' : 'dmh-fail'}>{check.ok ? '✓' : '✗'}</span>
          <span className="dmh-mono">{check.id}</span>
          <span className="dmh-muted dmh-mono">{check.detail}</span>
        </li>
      ))}
    </ul>
  )
}

interface CardState {
  busy: boolean
  template?: TemplateSummary
  sources?: SourceSummary
  error?: string
}

/** Provider-card panel (key `llm-pi-ai`). */
export function ProbeCard(props: ProviderCardOwnerProps & InjectedApi): ReactElement {
  const { provider, t, api } = props
  const [state, setState] = React.useState<CardState>({ busy: false })
  const kind = provider.declared === true ? t('probe.card.declared') : provider.declared === false ? t('probe.card.builtin') : t('probe.card.unknown')

  const run = React.useCallback(async () => {
    setState({ busy: true })
    const [template, sources] = await Promise.all([
      api.call('probe.template', { provider: provider.provider }),
      api.call('probe.sources', { provider: provider.provider }),
    ])
    setState({
      busy: false,
      ...template.ok ? { template: template.value } : { error: template.error.message },
      ...sources.ok ? { sources: sources.value } : { error: sources.error.message },
    })
  }, [api, provider.provider])

  const md = state.sources?.modelsDev
  const or = state.sources?.openrouter
  return (
    <div className="dmh-panel" data-dmh-card={provider.provider}>
      <Styles />
      <div className="dmh-row">
        <span className="dmh-title">{t('title')}</span>
        <span className="dmh-badge">{t('probe.badge')}</span>
        <span className="dmh-muted">{`${provider.provider} · ${kind}`}</span>
        <button type="button" className="dmh-button" disabled={state.busy} onClick={() => { void run() }}>
          {state.busy ? t('probe.card.checking') : t('probe.card.check')}
        </button>
      </div>
      {state.error === undefined ? null : <div className="dmh-fail">{t('error', { message: state.error })}</div>}
      {state.template === undefined ? null : (
        <div>
          <div>{state.template.modelCount > 0 ? t('probe.card.template', { count: state.template.modelCount }) : t('probe.card.templateNone')}</div>
          {state.template.groups.length === 0 ? null : (
            <ul className="dmh-list">
              {state.template.groups.map(group => (
                <li key={`${group.api} ${group.baseURL}`}>
                  <span className="dmh-mono">{group.api}</span>
                  <span className="dmh-muted dmh-mono">{group.baseURL}</span>
                  <span>{group.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {md === undefined ? null : md.ok
        ? (
            <div>
              <div>{t('probe.card.modelsDev', { count: md.count ?? 0, extra: md.onlyInSource?.length ?? 0 })}</div>
              <div className="dmh-muted">{md.detail}</div>
              {md.groups === undefined ? null : (
                <ul className="dmh-list">
                  {Object.entries(md.groups).map(([key, count]) => (
                    <li key={key}><span className="dmh-mono">{key}</span><span>{count}</span></li>
                  ))}
                </ul>
              )}
              {md.onlyInSource === undefined || md.onlyInSource.length === 0 ? null : (
                <details className="dmh-details">
                  <summary>{t('probe.card.extraList')}</summary>
                  <div className="dmh-mono">{md.onlyInSource.join(', ')}</div>
                </details>
              )}
            </div>
          )
        : <div className="dmh-warn">{md.detail}</div>}
      {or === undefined ? null : or.ok
        ? <div>{t('probe.card.openrouter', { count: or.count ?? 0, extra: or.onlyInSource ?? 0 })}</div>
        : <div className="dmh-warn">{or.detail}</div>}
    </div>
  )
}

/** Models-page footer panel: overall status and the write test. */
export function ProbeFooter(props: InjectedApi & { t: Translate }): ReactElement {
  const { api, t } = props
  const [status, setStatus] = React.useState<ProbeStatus | undefined>()
  const [writeChecks, setWriteChecks] = React.useState<ProbeCheck[] | undefined>()
  const [busy, setBusy] = React.useState<'status' | 'write' | undefined>()
  const [error, setError] = React.useState<string | undefined>()

  const refresh = React.useCallback(async () => {
    setBusy('status')
    const result = await api.call('probe.status', {})
    setBusy(undefined)
    if (result.ok) { setStatus(result.value); setError(undefined) } else setError(result.error.message)
  }, [api])

  React.useEffect(() => { void refresh() }, [refresh])

  const writeTest = async (): Promise<void> => {
    setBusy('write')
    const result = await api.call('probe.writeTest', {})
    setBusy(undefined)
    if (result.ok) setWriteChecks(result.value.checks)
    else setError(result.error.message)
    void refresh()
  }

  return (
    <div className="dmh-panel" data-dmh-footer="">
      <Styles />
      <div className="dmh-row">
        <span className="dmh-title">{t('probe.footer.title')}</span>
        <button type="button" className="dmh-button" disabled={busy !== undefined} onClick={() => { void refresh() }}>
          {busy === 'status' ? t('probe.footer.running') : t('probe.footer.refresh')}
        </button>
        <button type="button" className="dmh-button" disabled={busy !== undefined} title={t('probe.footer.writeTest.hint')} onClick={() => { void writeTest() }}>
          {busy === 'write' ? t('probe.footer.running') : t('probe.footer.writeTest')}
        </button>
      </div>
      <div className="dmh-muted">{t('probe.footer.writeTest.hint')}</div>
      {error === undefined ? null : <div className="dmh-fail">{t('error', { message: error })}</div>}
      {status === undefined ? null : (
        <>
          <CheckList checks={status.checks} t={t} />
          <div className="dmh-muted">{t('probe.footer.routes', { count: status.routes.length, revision: status.llmPiAiRevision ?? '?' })}</div>
          <ul className="dmh-list">
            {status.routes.map(route => (
              <li key={route.id}>
                <span className="dmh-mono">{route.id}</span>
                <span className="dmh-muted dmh-mono">
                  {`declared=${String(route.declared)} key=${route.apiKeyEnv ?? '-'} api=${route.api ?? '-'} models=${route.modelCount}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {writeChecks === undefined ? null : <CheckList checks={writeChecks} t={t} />}
    </div>
  )
}
