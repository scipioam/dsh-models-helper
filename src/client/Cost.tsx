/**
 * Conversation-area cost displays (M2).
 *
 * Both read the Host's usage projection through the slot's standard
 * `useProjection` prop and price it with the Client's local price table, so
 * rendering never fetches a source. Amounts are recomputed from tokens on
 * every render: changing an override re-prices every visible turn at once.
 */
import type { ReactElement } from 'react'
import { React } from './runtime.ts'
import type { HelperApi } from './api.ts'
import type { ConversationSlotProps, TurnTailOwnerProps } from './dsh.ts'
import { USAGE_TOTALS_KEY, USAGE_TURNS_KEY } from '../shared/rpc.ts'
import { formatTokens, formatUsd } from '../shared/cost.ts'
import { usePriceTable } from './prices.ts'
import type { CostSummary } from './cost-view.ts'
import { descendantRows, mergeRoutes, summarize, totalsValue, turnsValue } from './cost-view.ts'
import { Styles } from './ui.tsx'

function detailText(t: (key: string, params?: Record<string, string | number>) => string, summary: CostSummary): string {
  const lines = summary.lines.map(line => t('cost.detailLine', {
    route: `${line.provider}/${line.model}`,
    input: formatTokens(line.buckets.input),
    output: formatTokens(line.buckets.output),
    cacheRead: formatTokens(line.buckets.cacheRead),
    cacheWrite: formatTokens(line.buckets.cacheWrite),
    amount: line.amount === undefined ? t('cost.noPrice') : formatUsd(line.amount),
  }))
  if (summary.missing > 0) lines.push(t('cost.partial'))
  return lines.join('\n')
}

function Amount(props: { summary: CostSummary }): ReactElement {
  const { summary } = props
  if (summary.priced === 0) return <span className="dmh-cost-na">—</span>
  return <span>{formatUsd(summary.amount)}{summary.missing > 0 ? '*' : ''}</span>
}

/** Per-turn cost appended below a completed Turn. */
export function TurnCost(props: TurnTailOwnerProps & { api: HelperApi }): ReactElement | null {
  const { t, api, turn, useProjection } = props
  const usage = turnsValue(useProjection?.(USAGE_TURNS_KEY))
  const prices = usePriceTable(api)
  const turnNumber = turn?.turn
  if (turnNumber === undefined || usage === undefined) return null
  const routes = usage.turns[String(turnNumber)]
  if (routes === undefined) return null
  const summary = summarize(routes, prices.table)
  if (summary.lines.length === 0) return null
  return (
    <div className="dmh-cost-turn" title={detailText(t, summary)}>
      <Styles />
      <span className="dmh-cost-label">{t('cost.turn')}</span>
      <span className="dmh-cost-value"><Amount summary={summary} /></span>
      {summary.missing > 0 ? <span className="dmh-cost-na">{t('cost.partial')}</span> : null}
    </div>
  )
}

/** Session total in the session header, including subagent Sessions. */
export function SessionCost(props: ConversationSlotProps & { api: HelperApi }): ReactElement | null {
  const { t, api, sessionId, useProjection, useSessions } = props
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<{ right: number; top: number } | undefined>(undefined)
  const anchor = React.useRef<HTMLButtonElement>(null)
  const own = totalsValue(useProjection?.(USAGE_TOTALS_KEY))
  const list = useSessions?.()
  const prices = usePriceTable(api)
  const children = descendantRows(list, sessionId)

  if (own === undefined) return null
  let routes = own.totals
  let childValues = 0
  for (const child of children) {
    const value = totalsValue(child.projectionValues?.[USAGE_TOTALS_KEY])
    if (value === undefined) continue
    childValues += 1
    routes = mergeRoutes(routes, value.totals)
  }
  const summary = summarize(routes, prices.table)
  if (summary.lines.length === 0) return null

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [open])

  const toggle = (): void => {
    const rect = anchor.current?.getBoundingClientRect()
    if (rect !== undefined && typeof window !== 'undefined') {
      setPosition({ right: Math.max(8, window.innerWidth - rect.right), top: rect.bottom + 6 })
    }
    setOpen(value => !value)
  }

  return (
    <div className="dmh-cost-session">
      <Styles />
      <button
        ref={anchor}
        type="button"
        className="dmh-cost-button"
        title={detailText(t, summary)}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="dmh-cost-label">{t('cost.session')}</span>
        <span className="dmh-cost-value"><Amount summary={summary} /></span>
      </button>
      {open && position !== undefined ? (
        <>
          <div className="dmh-cost-backdrop" onClick={() => setOpen(false)} />
          <div className="dmh-cost-pop" role="dialog" aria-modal="false" aria-label={t('cost.breakdown')} style={{ right: position.right, top: position.top }}>
            <div className="dmh-cost-pop-title">{t('cost.breakdown')}</div>
            <ul className="dmh-cost-lines">
              {summary.lines.map(line => (
                <li key={`${line.provider}/${line.model}`} className="dmh-cost-line">
                  <span className="dmh-mono dmh-cost-route">{line.provider}/{line.model}</span>
                  <span className="dmh-cost-nums">
                    {t('cost.inOut', {
                      input: formatTokens(line.buckets.input),
                      output: formatTokens(line.buckets.output),
                    })}
                  </span>
                  <span className="dmh-cost-line-amount">{line.amount === undefined ? '—' : formatUsd(line.amount)}</span>
                </li>
              ))}
            </ul>
            {children.length === 0 ? null : (
              <div className="dmh-cost-note">
                {childValues === children.length
                  ? t('cost.subagents', { count: children.length })
                  : t('cost.subagentsPartial', { count: children.length, missing: children.length - childValues })}
              </div>
            )}
            {summary.missing > 0 ? <div className="dmh-cost-note">{t('cost.partial')}</div> : null}
            <div className="dmh-cost-note">{t('cost.localHint')}</div>
          </div>
        </>
      ) : null}
    </div>
  )
}
