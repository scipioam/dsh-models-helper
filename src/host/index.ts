/**
 * dsh-models-helper — Host half.
 *
 * M1: bindings + merge/diff engines + clone/bind/check-update actions behind
 * one owner-only RPC route. All operations are implemented once here; the
 * Client only renders state and calls them.
 */
import Schema from '@deepseek-ai/schemastery'
import type { HostContext } from './dsh.ts'
import { resetTemplateCatalog } from './pi-ai.ts'
import { registerRpc } from './rpc.ts'
import {
  bindOptions,
  bindingApply,
  bindingBind,
  bindingDiff,
  bindingLock,
  bindingUnbind,
  cacheRefresh,
  cloneApply,
  clonePlan,
  helperStatus,
  separateKey,
  useDefaultModel,
} from './actions.ts'

export const name = 'dsh-models-helper'

/**
 * Bindings (with locks and price overrides) are volatile so the Models page can
 * edit them live through `settings.mutate` without restarting this plugin.
 * Model-field and price snapshots live in the data directory instead.
 */
export const Config = Schema.object({
  bindings: Schema.dict(Schema.any()).default({}).volatile()
    .description('Custom pi-ai routes bound to a metadata source, keyed by route id.'),
})

export function apply(ctx: HostContext): void {
  ctx.effect(() => () => { resetTemplateCatalog() }, 'models-helper: template cache')
  ctx.inject(['connection'], (scoped) => {
    const connection = scoped.get('connection')
    if (connection === undefined) return
    // The route belongs to the Context that read `connection`; keep its
    // disposer in this plugin's own effect too, so either teardown removes it.
    const dispose = registerRpc(connection, {
      'helper.status': () => helperStatus(ctx),
      'cache.refresh': () => cacheRefresh(ctx),
      'clone.plan': args => clonePlan(ctx, args),
      'clone.apply': args => cloneApply(ctx, args),
      'bind.options': args => bindOptions(ctx, args),
      'binding.bind': args => bindingBind(ctx, args),
      'binding.diff': args => bindingDiff(ctx, args),
      'binding.apply': args => bindingApply(ctx, args),
      'binding.lock': args => bindingLock(ctx, args),
      'binding.unbind': args => bindingUnbind(ctx, args),
      'route.separateKey': args => separateKey(ctx, args),
      'defaultModel.use': args => useDefaultModel(ctx, args),
    }, ctx.logger)
    scoped.effect(() => dispose, 'models-helper: rpc route')
  })
}
