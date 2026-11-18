/** Diff panel: renders one binding's check-update result and applies a selection. */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import type { ApplySelection, BindingDiff, FieldDiff, ModelDiff, ModelFieldName } from '../shared/rpc.ts'
import { defaultSelection, entryForRow, type SelectionEntry } from './diff-selection.ts'
import { diffErrorText, errorText } from './errors.ts'
import { Banner, fieldLabel, fieldText, fmtTime, ProvenanceBadge, Styles } from './ui.tsx'

export interface DiffPanelProps {
  route: string
  diff: BindingDiff
  api: HelperApi
  t: Translate
  /** Parent reloads `helper.status`; the panel stays mounted until re-check. */
  onApplied: (message: string) => void
  /** Ask the parent to run check-update again (the diff's revision may be stale). */
  onRecheck: () => void
}

export function DiffPanel(props: DiffPanelProps): ReactElement {
  const { route, diff, api, t, onApplied, onRecheck } = props
  const [selection, setSelection] = React.useState<Map<string, SelectionEntry>>(() => defaultSelection(diff))
  const [locked, setLocked] = React.useState<Set<string>>(() => new Set(diff.locked))
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [message, setMessage] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    setSelection(defaultSelection(diff))
    setLocked(new Set(diff.locked))
    setError(undefined)
    setMessage(undefined)
  }, [diff])

  const selectedCount = [...selection.values()].reduce((count, entry) => count + (entry.mode === 'add' || entry.mode === 'remove' ? 1 : entry.fields.size), 0)

  const toggleModel = (row: ModelDiff, checked: boolean): void => {
    setSelection((previous) => {
      const next = new Map(previous)
      if (!checked) next.delete(row.id)
      else next.set(row.id, entryForRow(row))
      return next
    })
  }

  const toggleField = (row: ModelDiff, field: ModelFieldName, checked: boolean): void => {
    setSelection((previous) => {
      const next = new Map(previous)
      const current = next.get(row.id) ?? { mode: 'update' as const, fields: new Set<ModelFieldName>() }
      const fields = new Set(current.fields)
      if (checked) fields.add(field)
      else fields.delete(field)
      if (fields.size === 0) next.delete(row.id)
      else next.set(row.id, { mode: 'update', fields })
      return next
    })
  }

  const toggleLock = async (row: ModelDiff, field: ModelFieldName): Promise<void> => {
    const key = `${row.id}/${field}`
    const nextLocked = !locked.has(key)
    setBusy(true)
    const result = await api.call('binding.lock', { route, model: row.id, field, locked: nextLocked })
    setBusy(false)
    if (!result.ok) {
      setError(errorText(t, result.error))
      return
    }
    setLocked(new Set(result.value.locked))
    if (nextLocked) {
      setSelection((previous) => {
        const next = new Map(previous)
        const current = next.get(row.id)
        if (current === undefined) return next
        const fields = new Set(current.fields)
        fields.delete(field)
        if (fields.size === 0) next.delete(row.id)
        else next.set(row.id, { mode: 'update', fields })
        return next
      })
    }
  }

  const apply = async (): Promise<void> => {
    const rows: ApplySelection[] = []
    for (const [id, entry] of selection) {
      if (entry.mode === 'add' || entry.mode === 'remove') rows.push({ id, mode: entry.mode })
      else if (entry.fields.size > 0) rows.push({ id, mode: 'update', fields: [...entry.fields] })
    }
    if (rows.length === 0) return
    setBusy(true)
    setError(undefined)
    const result = await api.call('binding.apply', { route, revision: diff.revision, selection: rows })
    setBusy(false)
    if (!result.ok) {
      setError(errorText(t, result.error))
      return
    }
    setMessage(t('diff.applied', { count: rows.length }))
    onApplied(t('diff.applied', { count: rows.length }))
  }

  const checked = (row: ModelDiff): boolean => {
    const entry = selection.get(row.id)
    if (entry === undefined) return false
    if (entry.mode === 'add' || entry.mode === 'remove') return true
    return entry.fields.size > 0
  }

  const fieldChecked = (row: ModelDiff, field: ModelFieldName): boolean => selection.get(row.id)?.fields.has(field) === true

  const toggleGroup = (rows: readonly ModelDiff[], selectAll: boolean): void => {
    setSelection((previous) => {
      const next = new Map(previous)
      for (const row of rows) {
        if (!selectAll) next.delete(row.id)
        else {
          const entry = entryForRow(row)
          if (entry.mode === 'update' && entry.fields.size === 0) continue
          next.set(row.id, entry)
        }
      }
      return next
    })
  }

  const fieldRow = (row: ModelDiff, change: FieldDiff, selectable: boolean): ReactElement => {
    const key = `${row.id}/${change.field}`
    const isLocked = locked.has(key)
    return (
      <div className="dmh-field" key={change.field}>
        {selectable ? (
          <input type="checkbox" checked={fieldChecked(row, change.field)} disabled={busy || isLocked} aria-label={`${row.id} ${fieldLabel(t, change.field)}`} onChange={event => toggleField(row, change.field, event.target.checked)} />
        ) : <span className="dmh-muted">·</span>}
        <span className="dmh-muted">{fieldLabel(t, change.field)}</span>
        {change.old === undefined ? null : <span className="dmh-old dmh-mono">{fieldText(change.old)}</span>}
        {change.old === undefined ? null : <span className="dmh-muted">→</span>}
        <span className="dmh-new dmh-mono">{fieldText(change.new)}</span>
        <ProvenanceBadge t={t} provenance={change.provenance} />
        <button type="button" className="dmh-lock" title={t('diff.lock')} aria-pressed={isLocked} aria-label={`${isLocked ? t('diff.unlockField') : t('diff.lockField')} ${row.id} ${fieldLabel(t, change.field)}`} disabled={busy} onClick={() => { void toggleLock(row, change.field) }}>
          {isLocked ? '🔒' : '🔓'}
        </button>
      </div>
    )
  }

  const group = (title: string, rows: ModelDiff[], selectable: boolean, fieldSelectable: boolean, hint?: string): ReactElement | null => {
    if (rows.length === 0) return null
    return (
      <div className="dmh-group">
        <div className="dmh-row dmh-spread">
          <div className="dmh-row"><span className="dmh-sub">{title}</span>{hint === undefined ? null : <span className="dmh-hint">{hint}</span>}</div>
          {selectable ? (
            <button type="button" className="dmh-link" disabled={busy} onClick={() => toggleGroup(rows, !rows.every(row => checked(row)))}>
              {rows.every(row => checked(row)) ? t('diff.unselectAll') : t('diff.selectAll')}
            </button>
          ) : null}
        </div>
        <ul className="dmh-list dmh-scroll">
          {rows.map(row => (
            <li key={row.id} style={{ display: 'block' }}>
              <label className="dmh-check">
                {selectable ? <input type="checkbox" checked={checked(row)} disabled={busy} onChange={event => toggleModel(row, event.target.checked)} /> : null}
                <span className="dmh-mono">{row.id}</span>
              </label>
              {row.fields.map(change => fieldRow(row, change, fieldSelectable))}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (diff.error !== undefined) {
    return (
      <div className="dmh-group" data-dmh-diff={route}>
        <Styles />
        <Banner kind="err">{diffErrorText(t, diff)}</Banner>
      </div>
    )
  }

  const priceRows = diff.priceChanges.map(change => (
    <li key={change.id}>
      <span className="dmh-mono">{change.id}</span>
      <span className="dmh-muted dmh-mono">
        {`${change.old?.input ?? '—'}/${change.old?.output ?? '—'} → ${change.new?.input ?? '—'}/${change.new?.output ?? '—'}`}
      </span>
      {change.overridden ? <span className="dmh-badge dmh-badge-warn">{t('diff.priceOverridden')}</span> : null}
    </li>
  ))

  return (
    <div className="dmh-group" data-dmh-diff={route}>
      <Styles />
      <div className="dmh-row dmh-spread">
        <span className="dmh-title">{t('diff.title')}</span>
        <span className="dmh-muted">{diff.online ? t('diff.online', { time: fmtTime(diff.fetchedAt, t) }) : null}</span>
      </div>
      {diff.online ? null : <Banner kind="warn">{t('diff.stale', { time: fmtTime(diff.fetchedAt, t), reason: diff.staleReason ?? '' })}</Banner>}
      {diff.warning === 'template-missing' ? <Banner kind="warn">{t('diff.warning.template-missing')}</Banner> : null}
      {diff.locked.length > 0 ? <div className="dmh-hint">{t('diff.lockedNote', { count: diff.locked.length })}</div> : null}
      {group(t('diff.added', { count: diff.added.length }), diff.added, true, false)}
      {group(t('diff.candidates', { count: diff.candidates.length }), diff.candidates, true, false)}
      {group(t('diff.updates', { count: diff.updates.length }), diff.updates, true, true)}
      {group(t('diff.conflicts', { count: diff.conflicts.length }), diff.conflicts, true, true, t('diff.conflictHint'))}
      {group(t('diff.removed', { count: diff.removed.length }), diff.removed, true, false, t('diff.removedHint'))}
      {priceRows.length === 0 ? null : (
        <div className="dmh-group">
          <div className="dmh-row"><span className="dmh-sub">{t('diff.priceChanges')}</span></div>
          <ul className="dmh-list">{priceRows}</ul>
        </div>
      )}
      {diff.added.length + diff.candidates.length + diff.updates.length + diff.conflicts.length + diff.removed.length === 0 && diff.priceChanges.length === 0 ? <div className="dmh-hint">{t('diff.empty')}</div> : null}
      {error === undefined ? null : <Banner kind="err">{t('error', { message: error })}</Banner>}
      {message === undefined ? null : <Banner kind="ok">{message}</Banner>}
      <div className="dmh-actions">
        <button type="button" className="dmh-button dmh-button-primary" disabled={busy || selectedCount === 0} onClick={() => { void apply() }}>
          {busy ? t('diff.applying') : t('diff.apply')}
        </button>
        <button type="button" className="dmh-button" disabled={busy} onClick={() => onRecheck()}>
          {t('diff.recheck')}
        </button>
      </div>
    </div>
  )
}
