/**
 * Provider-card panel: one component registered for every `llm-pi-ai` card.
 * Built-in routes offer cloning; custom routes offer binding or update checks.
 * Wizards render inline (no host modal slot needed).
 */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { ProviderCardOwnerProps, Translate } from './dsh.ts'
import type { BindOptions, BindingDiff, CloneApplyResult, ClonePlan, SourceRef } from '../shared/rpc.ts'
import { deriveKeyRef } from '../shared/rpc.ts'
import { Banner, fmtTime, sourceLabel, Styles, useStatus } from './ui.tsx'
import { DiffPanel } from './DiffPanel.tsx'
import { BindPanel, CloneWizard } from './Wizards.tsx'
import { PriceTable } from './Prices.tsx'
import { loadPrices } from './prices.ts'

interface CardState {
  kind: 'none' | 'clone' | 'bind' | 'diff'
  clone?: ClonePlan
  bind?: BindOptions
  diff?: BindingDiff
}

export function Card(props: ProviderCardOwnerProps & { api: HelperApi }): ReactElement {
  const { provider, t, api } = props
  const { status, error, reload } = useStatus(api)
  const [state, setState] = React.useState<CardState>({ kind: 'none' })
  const [busy, setBusy] = React.useState<string | undefined>(undefined)
  const [actionError, setActionError] = React.useState<string | undefined>(undefined)
  const [cloneResult, setCloneResult] = React.useState<CloneApplyResult | undefined>(undefined)
  const [applied, setApplied] = React.useState<string | undefined>(undefined)
  const [keyMessage, setKeyMessage] = React.useState<string | undefined>(undefined)
  const [confirmUnbind, setConfirmUnbind] = React.useState(false)

  const route = status?.routes.find(row => row.id === provider.provider)
  const binding = status?.bindings.find(row => row.route === provider.provider)
  const declared = route?.declared ?? provider.declared === true

  const startClone = async (source?: SourceRef): Promise<void> => {
    setBusy('plan')
    setActionError(undefined)
    setCloneResult(undefined)
    const result = await api.call('clone.plan', { provider: provider.provider, ...source === undefined ? {} : { source } })
    setBusy(undefined)
    if (result.ok) setState({ kind: 'clone', clone: result.value })
    else setActionError(result.error.message)
  }

  const startBind = async (): Promise<void> => {
    setBusy('bind-options')
    setActionError(undefined)
    const result = await api.call('bind.options', { route: provider.provider })
    setBusy(undefined)
    if (result.ok) setState({ kind: 'bind', bind: result.value })
    else setActionError(result.error.message)
  }

  const check = async (): Promise<void> => {
    setBusy('check')
    setActionError(undefined)
    setApplied(undefined)
    const result = await api.call('binding.diff', { route: provider.provider })
    setBusy(undefined)
    if (result.ok) {
      const diff = result.value.results[0]
      if (diff !== undefined) setState({ kind: 'diff', diff })
    } else {
      setActionError(result.error.message)
    }
  }

  const unbind = async (): Promise<void> => {
    setBusy('unbind')
    const result = await api.call('binding.unbind', { route: provider.provider })
    setBusy(undefined)
    setConfirmUnbind(false)
    if (!result.ok) {
      setActionError(result.error.message)
      return
    }
    setState({ kind: 'none' })
    await reload()
  }

  // Repairs clones made before clone created its own credential reference:
  // copy the shared key into this route's derived reference and repoint it.
  const splitKey = async (): Promise<void> => {
    setBusy('split')
    setActionError(undefined)
    setKeyMessage(undefined)
    const result = await api.call('route.separateKey', { route: provider.provider })
    setBusy(undefined)
    if (result.ok) {
      setKeyMessage(t('card.splitKeyDone', { ref: result.value.ref }))
      await reload()
    } else {
      setActionError(result.error.message)
    }
  }

  const setAutoInclude = async (next: boolean): Promise<void> => {
    setBusy('auto-include')
    setActionError(undefined)
    const result = await api.call('binding.setAutoInclude', { route: provider.provider, autoIncludeNew: next })
    setBusy(undefined)
    if (result.ok) await reload()
    else setActionError(result.error.message)
  }

  const refreshLists = async (): Promise<void> => { await reload(); await loadPrices(api, true) }

  return (
    <div className="dmh-panel" data-dmh-card={provider.provider}>
      <Styles />
      <div className="dmh-row dmh-spread">
        <div className="dmh-row">
          <span className="dmh-title">{t('title')}</span>
          <span className="dmh-badge">{declared ? t('card.declared') : t('card.builtin')}</span>
          <span className="dmh-muted">{provider.provider}</span>
        </div>
        {route === undefined ? null : (
          <div className="dmh-row">
            {!declared && binding === undefined ? (
              <button type="button" className="dmh-button dmh-button-primary" disabled={busy !== undefined} onClick={() => { void startClone() }}>
                {busy === 'plan' ? t('busy') : t('card.clone')}
              </button>
            ) : null}
            {declared && binding === undefined ? (
              <button type="button" className="dmh-button dmh-button-primary" disabled={busy !== undefined} onClick={() => { void startBind() }}>
                {busy === 'bind-options' ? t('busy') : t('card.bind')}
              </button>
            ) : null}
            {declared && binding !== undefined ? (
              <>
                <button type="button" className="dmh-button dmh-button-primary" disabled={busy !== undefined} onClick={() => { void check() }}>
                  {busy === 'check' ? t('card.checking') : t('card.check')}
                </button>
                <button type="button" className="dmh-button dmh-button-danger" disabled={busy !== undefined} onClick={() => setConfirmUnbind(true)}>
                  {t('card.unbind')}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
      {actionError === undefined ? null : <Banner kind="err">{t('error', { message: actionError })}</Banner>}

      {!declared && route !== undefined && route.sharedKeyWith !== undefined && route.sharedKeyWith.length > 0 ? (
        <Banner kind="warn">{t('card.deleteKeyWarn', { key: route.apiKeyEnv ?? '?' })}</Banner>
      ) : null}
      {declared && route?.apiKeyEnv !== undefined && route.apiKeyEnv !== deriveKeyRef(provider.provider) && (route.sharedKeyWith?.length ?? 0) > 0 ? (
        <>
          <Banner kind="warn">{t('card.sharedKeyWarn', { key: route.apiKeyEnv, others: (route.sharedKeyWith ?? []).join(', ') })}</Banner>
          <div className="dmh-actions">
            <button type="button" className="dmh-button" disabled={busy !== undefined} onClick={() => { void splitKey() }}>
              {busy === 'split' ? t('card.splittingKey') : t('card.splitKey')}
            </button>
          </div>
        </>
      ) : null}
      {keyMessage === undefined ? null : <Banner kind="ok">{keyMessage}</Banner>}
      {status?.defaultSelection?.provider === provider.provider ? <div className="dmh-hint">{t('card.defaultNote')}</div> : null}

      {binding === undefined ? null : (
        <div>
          <div className="dmh-muted">{t('card.boundTo', { source: sourceLabel(t, binding.source), template: binding.template })}</div>
          <div className="dmh-muted">
            {binding.lastSync === undefined ? t('time.never') : t('time.lastSync', { time: fmtTime(binding.lastSync, t) })}
            {binding.locked.length > 0 ? ` · ${t('card.lockedCount', { count: binding.locked.length })}` : ''}
          </div>
          {/* The explanation is a hover tooltip so a long paragraph does not
              push the card's other controls down. */}
          <label className="dmh-check" title={t('card.autoIncludeHint')}>
            <input
              type="checkbox"
              checked={binding.autoIncludeNew}
              disabled={busy !== undefined}
              onChange={event => { void setAutoInclude(event.target.checked) }}
            />
            <span className="dmh-hint">{t('card.autoInclude')}</span>
          </label>
        </div>
      )}

      {declared ? <PriceTable route={provider.provider} api={api} t={t} /> : null}

      {confirmUnbind ? (
        <div className="dmh-actions">
          <span className="dmh-warn">{t('card.unbindConfirm')}</span>
          <button type="button" className="dmh-button dmh-button-danger" disabled={busy !== undefined} onClick={() => { void unbind() }}>{t('card.unbind')}</button>
          <button type="button" className="dmh-button" onClick={() => setConfirmUnbind(false)}>{t('cancel')}</button>
        </div>
      ) : null}

      {applied === undefined ? null : <Banner kind="ok">{applied}</Banner>}

      {state.kind === 'clone' && state.clone !== undefined ? (
        <CloneWizard
          plan={state.clone}
          api={api}
          t={t}
          isOpenRouter={provider.provider === 'openrouter'}
          onSource={source => { void startClone(source) }}
          onCancel={() => setState({ kind: 'none' })}
          onDone={(result) => {
            setCloneResult(result)
            setState({ kind: 'none' })
            void refreshLists()
          }}
        />
      ) : null}

      {cloneResult === undefined ? null : (
        <div className="dmh-group">
          <Banner kind="ok">{t('clone.done', { routes: cloneResult.routes.join(', ') })}</Banner>
          {cloneResult.keys === undefined ? null : cloneResult.keys.map(key => (
            key.status === 'copied'
              ? <div key={key.route} className="dmh-muted">{t('clone.keyCopied', { routes: key.route })}</div>
              : <Banner key={key.route} kind="warn">{t('clone.keyPending', { routes: key.route, ref: key.ref })}</Banner>
          ))}
          {cloneResult.defaultSuggestion === undefined ? null : <DefaultSuggestion api={api} t={t} suggestion={cloneResult.defaultSuggestion} />}
        </div>
      )}

      {state.kind === 'bind' && state.bind !== undefined ? (
        <BindPanel
          options={state.bind}
          api={api}
          t={t}
          onCancel={() => setState({ kind: 'none' })}
          onBound={(diff) => {
            setState({ kind: 'diff', diff })
            void refreshLists()
          }}
        />
      ) : null}

      {state.kind === 'diff' && state.diff !== undefined ? (
        <DiffPanel
          route={state.diff.route}
          diff={state.diff}
          api={api}
          t={t}
          onApplied={(message) => {
            setApplied(message)
            void refreshLists()
          }}
        />
      ) : null}
    </div>
  )
}

function DefaultSuggestion(props: { api: HelperApi; t: Translate; suggestion: { provider: string; model: string; reasoningEffort?: string } }): ReactElement {
  const { api, t, suggestion } = props
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const use = async (): Promise<void> => {
    setBusy(true)
    const result = await api.call('defaultModel.use', suggestion)
    setBusy(false)
    if (result.ok) setDone(true)
    else setError(result.error.message)
  }
  if (done) return <Banner kind="ok">{t('clone.switchDefault')}</Banner>
  return (
    <div>
      <div className="dmh-hint">{t('clone.defaultPrompt', { model: suggestion.model, provider: suggestion.provider })}</div>
      <div className="dmh-actions">
        <button type="button" className="dmh-button dmh-button-primary" disabled={busy} onClick={() => { void use() }}>{t('clone.switchDefault')}</button>
      </div>
      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
    </div>
  )
}
