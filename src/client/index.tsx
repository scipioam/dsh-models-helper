/**
 * dsh-models-helper — Client half. Registered through the page's module
 * loader; React comes from the loader's module table.
 */
import type * as ReactNS from 'react'
import { setReact } from './runtime.ts'
import { createApi } from './api.ts'
import type { ClientContext } from './dsh.ts'
import { en, NS, zh } from './locales.ts'
import { ProbeCard, ProbeFooter } from './ProbeViews.tsx'
import { PACKAGE_NAME } from '../shared/rpc.ts'

declare global {
  interface Window {
    __ModuleLoader__: {
      load(definition: { id: string; factory: (require: (id: string) => unknown) => unknown }): void
    }
  }
}

/** Built-in locales without their own dictionary fall back to English text. */
const OTHER_LOCALES = ['ja', 'de', 'es', 'fr', 'pt', 'ru']

function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'models-helper: zh')
  ctx.effect(() => ctx.locale.register(NS, 'en', en), 'models-helper: en')
  for (const locale of OTHER_LOCALES) {
    ctx.effect(() => ctx.locale.register(NS, locale, en), `models-helper: ${locale}`)
  }
  const api = createApi(ctx.connection)

  ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
    name: 'settings.models.provider-card',
    key: 'llm-pi-ai',
    locale: NS,
    inject: () => ({ api }),
  }, ProbeCard))

  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer',
    id: 'dsh-models-helper',
    order: 50,
    locale: NS,
    inject: () => ({ api }),
  }, ProbeFooter))
}

window.__ModuleLoader__.load({
  id: PACKAGE_NAME,
  factory(require) {
    setReact(require('react') as typeof ReactNS)
    return { inject: ['slots', 'locale', 'connection'], apply }
  },
})
