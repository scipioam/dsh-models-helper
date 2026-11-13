/** Inline wizards: clone a built-in provider, bind an existing custom route. */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import type {
  BindOptions,
  BindingDiff,
  CloneApplyResult,
  CloneGroup,
  CloneGroupChoice,
  ClonePlan,
  SourceRef,
} from '../shared/rpc.ts'
import { Banner, Styles } from './ui.tsx'

interface GroupState {
  selected: boolean
  routeId: string
  displayName: string
  autoInclude: boolean
  modelIds: Set<string>
  search: string
}

function initialGroups(plan: ClonePlan): Map<string, GroupState> {
  const map = new Map<string, GroupState>()
  for (const group of plan.groups) {
    map.set(`${group.api}\u0000${group.baseURL}`, {
      selected: true,
      routeId: group.suggestedId,
      displayName: group.suggestedName,
      autoInclude: group.autoIncludeNew,
      modelIds: new Set(group.models.map(model => model.id)),
      search: '',
    })
  }
  return map
}

export interface CloneWizardProps {
  plan: ClonePlan
  api: HelperApi
  t: Translate
  isOpenRouter: boolean
  onSource: (source: SourceRef) => void
  onCancel: () => void
  onDone: (result: CloneApplyResult) => void
}

export function CloneWizard(props: CloneWizardProps): ReactElement {
  const { plan, api, t, isOpenRouter, onSource, onCancel, onDone } = props
  const [groups, setGroups] = React.useState<Map<string, GroupState>>(() => initialGroups(plan))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)

  const update = (key: string, apply: (group: GroupState) => GroupState): void => {
    setGroups((previous) => {
      const next = new Map(previous)
      const current = next.get(key)
      if (current !== undefined) next.set(key, apply(current))
      return next
    })
  }

  const confirm = async (): Promise<void> => {
    const chosen: CloneGroupChoice[] = []
    for (const group of plan.groups) {
      const state = groups.get(`${group.api}\u0000${group.baseURL}`)
      if (state === undefined || !state.selected) continue
      chosen.push({
        api: group.api,
        baseURL: group.baseURL,
        routeId: state.routeId.trim(),
        displayName: state.displayName.trim(),
        autoIncludeNew: state.autoInclude,
        modelIds: group.models.filter(model => state.modelIds.has(model.id)).map(model => model.id),
      })
    }
    if (chosen.length === 0) {
      setError(t('clone.noSelection'))
      return
    }
    setBusy(true)
    setError(undefined)
    const result = await api.call('clone.apply', { provider: plan.provider, source: plan.source, groups: chosen })
    setBusy(false)
    if (result.ok) onDone(result.value)
    else setError(result.error.message)
  }

  const groupCard = (group: CloneGroup): ReactElement => {
    const key = `${group.api}\u0000${group.baseURL}`
    const state = groups.get(key)
    if (state === undefined) return <div key={key} />
    const search = state.search.trim().toLowerCase()
    const models = group.models.filter(model => search.length === 0 || model.id.toLowerCase().includes(search))
    const toggleAll = (checked: boolean): void => {
      update(key, current => ({ ...current, modelIds: checked ? new Set(group.models.map(model => model.id)) : new Set() }))
    }
    return (
      <div className="dmh-group" key={key}>
        <label className="dmh-check">
          <input type="checkbox" checked={state.selected} onChange={event => update(key, current => ({ ...current, selected: event.target.checked }))} />
          <span className="dmh-sub">{t('clone.groupSelect')}</span>
          <span className="dmh-mono">{group.api}</span>
          <span className="dmh-muted dmh-mono">{group.baseURL}</span>
          <span className="dmh-muted">{t('clone.models', { count: group.models.length })}</span>
        </label>
        {group.withheldCompat > 0 ? <div className="dmh-hint">{t('clone.withheld', { count: group.withheldCompat })}</div> : null}
        {group.templateOnly > 0 ? <div className="dmh-hint">{t('clone.templateOnly', { count: group.templateOnly })}</div> : null}
        {group.noTemplate > 0 ? <div className="dmh-hint">{t('clone.noTemplate', { count: group.noTemplate })}</div> : null}
        {state.selected ? (
          <div>
            <div className="dmh-row" style={{ marginTop: 6 }}>
              <label className="dmh-hint">
                {t('clone.routeId')}
                <input className="dmh-input dmh-mono" value={state.routeId} onChange={event => update(key, current => ({ ...current, routeId: event.target.value }))} />
              </label>
              <label className="dmh-hint">
                {t('clone.displayName')}
                <input className="dmh-input" value={state.displayName} onChange={event => update(key, current => ({ ...current, displayName: event.target.value }))} />
              </label>
              <label className="dmh-check">
                <input type="checkbox" checked={state.autoInclude} onChange={event => update(key, current => ({ ...current, autoInclude: event.target.checked }))} />
                <span className="dmh-hint">{t('clone.autoInclude')}</span>
              </label>
            </div>
            <div className="dmh-row" style={{ marginTop: 6 }}>
              <input className="dmh-input" placeholder={t('clone.search')} value={state.search} onChange={event => update(key, current => ({ ...current, search: event.target.value }))} />
              <button type="button" className="dmh-button" onClick={() => toggleAll(true)}>{t('clone.selectAll')}</button>
              <button type="button" className="dmh-button" onClick={() => toggleAll(false)}>{t('clone.selectNone')}</button>
              <span className="dmh-hint">{t('clone.models', { count: state.modelIds.size })}</span>
            </div>
            <ul className="dmh-list dmh-scroll">
              {models.map(model => (
                <li key={model.id}>
                  <input
                    type="checkbox"
                    checked={state.modelIds.has(model.id)}
                    onChange={(event) => {
                      update(key, (current) => {
                        const modelIds = new Set(current.modelIds)
                        if (event.target.checked) modelIds.add(model.id)
                        else modelIds.delete(model.id)
                        return { ...current, modelIds }
                      })
                    }}
                  />
                  <span className="dmh-mono">{model.id}</span>
                  {model.fields.name === undefined ? null : <span className="dmh-muted">{model.fields.name}</span>}
                  {model.templateOnly ? <span className="dmh-badge dmh-badge-warn">{t('clone.templateOnlyBadge')}</span> : null}
                  {!model.inTemplate ? <span className="dmh-badge dmh-badge-warn">{t('clone.inferredBadge')}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="dmh-group" data-dmh-wizard="clone">
      <Styles />
      <div className="dmh-row dmh-spread">
        <span className="dmh-title">{t('clone.title', { provider: plan.provider })}</span>
        <button type="button" className="dmh-button" onClick={onCancel}>{t('cancel')}</button>
      </div>
      <div className="dmh-muted">{t('clone.source', { source: plan.source.kind === 'openrouter' ? t('source.openrouter') : `${t('source.models-dev')} · ${plan.source.provider}${plan.sourceName === undefined ? '' : ` (${plan.sourceName})`}` })}</div>
      {plan.templateVersion === undefined ? null : <div className="dmh-muted">{t('clone.templateVersion', { version: plan.templateVersion })}</div>}
      {plan.online ? null : <Banner kind="warn">{t('clone.stale', { time: plan.fetchedAt, reason: plan.staleReason ?? '' })}</Banner>}
      {isOpenRouter ? (
        <div className="dmh-actions">
          <button type="button" className="dmh-button" onClick={() => onSource({ kind: 'models-dev', provider: plan.provider })}>{t('source.models-dev')}</button>
          <button type="button" className="dmh-button" onClick={() => onSource({ kind: 'openrouter' })}>{t('source.openrouter')}</button>
        </div>
      ) : null}
      <div className="dmh-hint">{t('clone.hint')}</div>
      {plan.groups.map(groupCard)}
      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
      <div className="dmh-actions">
        <button type="button" className="dmh-button dmh-button-primary" disabled={busy} onClick={() => { void confirm() }}>
          {busy ? t('clone.applying') : t('clone.confirm')}
        </button>
        <button type="button" className="dmh-button" disabled={busy} onClick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  )
}

export interface BindPanelProps {
  options: BindOptions
  api: HelperApi
  t: Translate
  onCancel: () => void
  onBound: (diff: BindingDiff) => void
}

export function BindPanel(props: BindPanelProps): ReactElement {
  const { options, api, t, onCancel, onBound } = props
  const [sourceIndex, setSourceIndex] = React.useState(0)
  const [templateIndex, setTemplateIndex] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const source = options.sources[sourceIndex]
  const template = options.templates[templateIndex]

  const bind = async (): Promise<void> => {
    if (source === undefined) {
      setError(t('bind.noSources'))
      return
    }
    if (template === undefined) {
      setError(t('bind.noTemplates'))
      return
    }
    setBusy(true)
    setError(undefined)
    const result = await api.call('binding.bind', {
      route: options.route,
      option: { source: source.source, template, api: options.api, baseURL: options.baseURL },
    })
    setBusy(false)
    if (result.ok) onBound(result.value.diff)
    else setError(result.error.message)
  }

  return (
    <div className="dmh-group" data-dmh-wizard="bind">
      <Styles />
      <div className="dmh-row dmh-spread">
        <span className="dmh-title">{t('bind.title')}</span>
        <button type="button" className="dmh-button" onClick={onCancel}>{t('cancel')}</button>
      </div>
      <div className="dmh-hint">{t('bind.hint')}</div>
      <div className="dmh-row" style={{ marginTop: 6 }}>
        <label className="dmh-hint">
          {t('bind.source')}
          <select className="dmh-select" value={sourceIndex} onChange={event => setSourceIndex(Number(event.target.value))}>
            {options.sources.map((candidate, index) => (
              <option key={`${candidate.source.kind}:${candidate.source.kind === 'openrouter' ? '' : candidate.source.provider}`} value={index}>
                {`${candidate.label} (${candidate.modelCount})`}
              </option>
            ))}
          </select>
        </label>
        <label className="dmh-hint">
          {t('bind.template')}
          <select className="dmh-select" value={templateIndex} onChange={event => setTemplateIndex(Number(event.target.value))}>
            {options.templates.map((candidate, index) => <option key={candidate} value={index}>{candidate}</option>)}
          </select>
        </label>
      </div>
      {options.sources.length === 0 ? <Banner kind="err">{t('bind.noSources')}</Banner> : null}
      {options.templates.length === 0 ? <Banner kind="warn">{t('bind.noTemplates')}</Banner> : null}
      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
      <div className="dmh-actions">
        <button type="button" className="dmh-button dmh-button-primary" disabled={busy || options.sources.length === 0 || options.templates.length === 0} onClick={() => { void bind() }}>
          {busy ? t('busy') : t('bind.confirm')}
        </button>
        <button type="button" className="dmh-button" disabled={busy} onClick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  )
}
