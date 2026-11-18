/**
 * Read views of the `llm-pi-ai` settings namespace shared by the action and
 * price layers: effective vs profile-layer config, route directory, and the
 * small normalizers both need.
 */
import type { HostContext, LlmConfigurableProvider } from './dsh.ts'
import type { RawLlmConfig, RawModel, RawProfile } from './domain.ts'
import { LLM_PI_AI_NS } from './domain.ts'
import { deriveKeyRef } from '../shared/rpc.ts'
import { descriptor } from './store.ts'

/** The effective config (`value`), including schema-materialized defaults. */
export function effectiveConfig(ctx: HostContext): RawLlmConfig {
  return (descriptor(ctx, LLM_PI_AI_NS)?.value ?? {}) as RawLlmConfig
}

/** The profile layer only (`user`), without defaults. */
export function userConfig(ctx: HostContext): RawLlmConfig {
  return (descriptor(ctx, LLM_PI_AI_NS)?.user ?? {}) as RawLlmConfig
}

export function effectiveProfile(ctx: HostContext, route: string): RawProfile | undefined {
  return effectiveConfig(ctx).providers?.[route]
}

export function userProfile(ctx: HostContext, route: string): RawProfile | undefined {
  return userConfig(ctx).providers?.[route]
}

export function routeDirectory(ctx: HostContext): Map<string, LlmConfigurableProvider> {
  const rows = ctx.get('llm')?.listConfigurableProviders() ?? []
  return new Map(rows.filter(row => row.settingsNs === LLM_PI_AI_NS).map(row => [row.provider, row]))
}

export function isDeclared(ctx: HostContext, route: string): boolean {
  return routeDirectory(ctx).get(route)?.declared === true
}

export function userModels(ctx: HostContext, route: string): RawModel[] {
  const models = userProfile(ctx, route)?.models
  return Array.isArray(models)
    ? models.filter((model): model is RawModel => model !== null && typeof model === 'object' && typeof (model as RawModel).id === 'string')
    : []
}

/** Credential reference of a route: its effective value, else the model-page derivation. */
export function apiKeyEnvOf(ctx: HostContext, route: string): string | undefined {
  const fromRoute = effectiveProfile(ctx, route)?.apiKeyEnv
  if (typeof fromRoute === 'string' && fromRoute.length > 0) return fromRoute
  return deriveKeyRef(route)
}

/** Every route the Models page can show: config providers plus the live directory. */
export function routeIds(ctx: HostContext): string[] {
  const effective = effectiveConfig(ctx)
  return [...new Set([...Object.keys(effective.providers ?? {}), ...routeDirectory(ctx).keys()])]
}
