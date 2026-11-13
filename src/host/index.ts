/**
 * dsh-models-helper — Host half.
 *
 * M0: technical probes behind one owner-only RPC route. Later milestones add
 * bindings, the merge engine, diff/apply, prices and cost projections.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import type { HostContext } from './dsh.ts'
import { resetTemplateCatalog } from './pi-ai.ts'
import { dataDir, probeSources, probeStatus, probeTemplate, probeWriteTest } from './probe.ts'
import { registerRpc, RpcError } from './rpc.ts'

/**
 * M0 only: keep the latest result of each probe on disk so the developer can
 * read what the page saw without screen access.
 */
async function recordProbe<T>(ctx: HostContext, name: string, result: Promise<T>): Promise<T> {
  const value = await result
  try {
    const dir = join(dataDir(ctx), 'probe-results')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${name}.json`), `${JSON.stringify({ at: new Date().toISOString(), value }, null, 2)}\n`, 'utf8')
  } catch (error) {
    ctx.logger.warn('models-helper: cannot record probe %s: %s', name, error instanceof Error ? error.message : String(error))
  }
  return value
}

export const name = 'dsh-models-helper'

/**
 * Bindings and price overrides are volatile so the Models page can edit them
 * live through `settings.mutate` without restarting this plugin.
 */
export const Config = Schema.object({
  bindings: Schema.dict(Schema.any()).default({}).volatile()
    .description('Custom pi-ai routes bound to a metadata source, keyed by route id.'),
  probe: Schema.object({
    lastWriteTest: Schema.string(),
  }).volatile().description('Scratch field used by the M0 write probe; normally absent.'),
})

export function apply(ctx: HostContext): void {
  ctx.effect(() => () => { resetTemplateCatalog() }, 'models-helper: template cache')
  ctx.inject(['connection'], (scoped) => {
    const connection = scoped.get('connection')
    if (connection === undefined) return
    // The route belongs to the Context that read `connection`; keep its
    // disposer in this plugin's own effect too, so either teardown removes it.
    const dispose = registerRpc(connection, {
      'probe.status': () => recordProbe(ctx, 'status', probeStatus(ctx)),
      'probe.template': (args) => {
        if (typeof args.provider !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(args.provider)) throw new RpcError('models-helper/bad-request', 'provider is required')
        return recordProbe(ctx, `template-${args.provider}`, probeTemplate(ctx, args.provider))
      },
      'probe.sources': (args, signal) => {
        if (typeof args.provider !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(args.provider)) throw new RpcError('models-helper/bad-request', 'provider is required')
        return recordProbe(ctx, `sources-${args.provider}`, probeSources(ctx, args.provider, signal))
      },
      'probe.writeTest': () => recordProbe(ctx, 'write-test', probeWriteTest(ctx)),
    }, ctx.logger)
    scoped.effect(() => dispose, 'models-helper: rpc route')
  })
}
