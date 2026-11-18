/**
 * Provider-card price table (M2): every model's resolved unit price and where
 * it came from, with inline editing of the manual override. Editing only
 * writes the plugin Config; the shared price table refreshes so all visible
 * estimates re-price immediately.
 */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { Translate } from './dsh.ts'
import type { ModelPriceView, Price } from '../shared/rpc.ts'
import { fmtTime, Styles } from './ui.tsx'
import { errorText } from './errors.ts'
import { loadPrices, savePriceOverride, usePriceTable } from './prices.ts'

interface Draft {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

function draftOf(price: Price | undefined): Draft {
  return {
    input: price === undefined ? '' : String(price.input),
    output: price === undefined ? '' : String(price.output),
    cacheRead: price?.cacheRead === undefined ? '' : String(price.cacheRead),
    cacheWrite: price?.cacheWrite === undefined ? '' : String(price.cacheWrite),
  }
}

function parseField(value: string): number | undefined {
  const text = value.trim()
  if (text.length === 0) return undefined
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function priceText(price: Price | undefined, t: Translate): string {
  if (price === undefined) return '—'
  const cacheRead = price.cacheRead ?? price.input
  const cacheWrite = price.cacheWrite ?? price.input
  return t('prices.summary', {
    input: String(price.input),
    output: String(price.output),
    cacheRead: String(cacheRead),
    cacheWrite: String(cacheWrite),
  })
}

function sourceLabel(t: Translate, source: ModelPriceView['source']): string {
  return t(`prices.source.${source}`)
}

function tierText(price: Price | undefined): string | undefined {
  if (price?.tiers === undefined || price.tiers.length === 0) return undefined
  return price.tiers
    .map(tier => `>${tier.inputTokensAbove}: ${tier.input}/${tier.output}`)
    .join(' · ')
}

export function PriceTable(props: { route: string; api: HelperApi; t: Translate }): ReactElement | null {
  const { route, api, t } = props
  const prices = usePriceTable(api)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<string | undefined>(undefined)
  const [draft, setDraft] = React.useState<Draft>({ input: '', output: '', cacheRead: '', cacheWrite: '' })
  const [busy, setBusy] = React.useState<string | undefined>(undefined)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const [note, setNote] = React.useState<string | undefined>(undefined)

  const table = prices.table?.routes.find(row => row.route === route)
  if (table === undefined) {
    if (prices.status !== 'error' || prices.error === undefined) return null
    return (
      <div className="dmh-hint">
        {errorText(t, prices.error)}{' '}
        <button type="button" className="dmh-link" onClick={() => { void loadPrices(api, true) }}>{t('retry')}</button>
      </div>
    )
  }

  const startEdit = (model: ModelPriceView): void => {
    setEditing(model.id)
    setDraft(draftOf(model.price))
    setError(undefined)
    setNote(undefined)
  }

  const save = async (model: ModelPriceView, clear: boolean): Promise<void> => {
    setBusy(model.id)
    setError(undefined)
    let price: Price | null = null
    if (!clear) {
      const input = parseField(draft.input)
      const output = parseField(draft.output)
      if (input === undefined || output === undefined) {
        setBusy(undefined)
        setError(t('prices.invalid'))
        return
      }
      price = { input, output }
      // The editor changes base rates only; keep the snapshot's tier
      // thresholds so long-context pricing survives an override.
      if (model.price?.tiers !== undefined) price.tiers = model.price.tiers
      const cacheRead = parseField(draft.cacheRead)
      const cacheWrite = parseField(draft.cacheWrite)
      // An invalid cache value must not be silently dropped: that would save a
      // price different from what the user typed.
      if (draft.cacheRead.trim().length > 0 && cacheRead === undefined) {
        setBusy(undefined)
        setError(t('prices.invalid'))
        return
      }
      if (draft.cacheWrite.trim().length > 0 && cacheWrite === undefined) {
        setBusy(undefined)
        setError(t('prices.invalid'))
        return
      }
      if (cacheRead !== undefined) price.cacheRead = cacheRead
      if (cacheWrite !== undefined) price.cacheWrite = cacheWrite
    }
    const result = await savePriceOverride(api, route, model.id, price)
    setBusy(undefined)
    if (!result.ok) {
      setError(errorText(t, result.error))
      return
    }
    setEditing(undefined)
    setNote(clear ? t('prices.resetDone', { model: model.id }) : t('prices.saved', { model: model.id }))
  }

  const priced = table.models.filter(model => model.price !== undefined).length
  return (
    <div className="dmh-prices">
      <Styles />
      <div className="dmh-row dmh-spread">
        <button type="button" className="dmh-link" onClick={() => setOpen(value => !value)} aria-expanded={open}>
          {open ? t('prices.hide') : t('prices.show', { priced, total: table.models.length })}
        </button>
        <span className="dmh-muted">
          {table.fetchedAt === undefined ? t('prices.noSnapshot') : t('prices.fetched', { time: fmtTime(table.fetchedAt, t) })}
          {table.online === false ? ` · ${t('prices.stale')}` : ''}
        </span>
      </div>
      {note === undefined ? null : <div className="dmh-hint">{note}</div>}
      {!open ? null : (
        <div className="dmh-price-list">
          <div className="dmh-hint">{t('prices.hint')}</div>
          {table.models.map((model) => (
            <div key={model.id} className="dmh-price-row">
              <div className="dmh-price-main">
                <span className="dmh-mono dmh-price-model">{model.id}</span>
                <span className="dmh-price-nums" title={tierText(model.price)}>{priceText(model.price, t)}</span>
                {tierText(model.price) === undefined ? null : <span className="dmh-muted">{t('prices.tiers', { tiers: tierText(model.price) ?? '' })}</span>}
                <span className={`dmh-badge${model.source === 'override' ? ' dmh-badge-ok' : model.source === 'none' ? ' dmh-badge-err' : ''}`}>
                  {sourceLabel(t, model.source)}
                </span>
                {model.source === 'override' && model.fetchedAt !== undefined ? (
                  <span className="dmh-muted">{t('prices.sourceSnapshotAt', { time: fmtTime(model.fetchedAt, t) })}</span>
                ) : null}
                {model.staleReason === undefined ? null : <span className="dmh-warn" title={model.staleReason}>{t('prices.stale')}</span>}
              </div>
              {editing === model.id ? (
                <div className="dmh-price-edit">
                  {(['input', 'output', 'cacheRead', 'cacheWrite'] as const).map(field => (
                    <label key={field} className="dmh-price-field">
                      <span className="dmh-muted">{t(`prices.${field}`)}</span>
                      <input
                        className="dmh-input dmh-price-input"
                        type="number"
                        min="0"
                        step="any"
                        value={draft[field]}
                        placeholder={field === 'input' || field === 'output' ? '0' : t('prices.optional')}
                        onChange={event => setDraft({ ...draft, [field]: event.target.value })}
                      />
                    </label>
                  ))}
                  {error === undefined ? null : <div className="dmh-banner dmh-banner-err">{error}</div>}
                  <div className="dmh-actions">
                    <button type="button" className="dmh-button dmh-button-primary" disabled={busy !== undefined} onClick={() => { void save(model, false) }}>
                      {busy === model.id ? t('busy') : t('prices.save')}
                    </button>
                    {model.source === 'override' ? (
                      <button type="button" className="dmh-button" disabled={busy !== undefined} onClick={() => { void save(model, true) }}>
                        {t('prices.reset')}
                      </button>
                    ) : null}
                    <button type="button" className="dmh-button" disabled={busy !== undefined} onClick={() => setEditing(undefined)}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="dmh-button dmh-price-edit-button" onClick={() => startEdit(model)}>
                  {t('prices.edit')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
