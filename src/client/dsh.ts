/**
 * Minimal structural views of the DSH Client services this plugin uses,
 * mirroring the installed 0.2.2-rc.2 contracts (inspected live).
 */
import type { RpcResult } from '../shared/rpc.ts'

export type Translate = (key: string, params?: Record<string, string | number>) => string

export interface ClientConnection {
  readonly rpc: {
    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResult<unknown>>
  }
}

export interface ClientLocale {
  register(ns: string, locale: string, dict: Record<string, string>): () => void
  bind(ns: string): Translate
  getLocale(): { active: string }
}

export interface SlotRegistration {
  name: string
  id?: string
  key?: string
  order?: number
  locale?: string
  label?: string | (() => string)
  inject?: (...args: any[]) => object
}

export interface ClientSlots {
  inject(name: string, callback: () => unknown): () => void
  register(options: SlotRegistration, component: unknown): unknown
}

export interface ClientContext {
  readonly slots: ClientSlots
  readonly locale: ClientLocale
  readonly connection: ClientConnection
  effect(callback: () => (() => unknown) | void, label?: string): () => unknown
}

/** `settings.models.provider-card` owner props (from the Models page slot contract). */
export interface ProviderCardOwnerProps {
  provider: {
    provider: string
    displayName: string
    settingsNs: string
    active: boolean
    declared?: boolean
    defaultBaseURL?: string
    error?: string
  }
  configured: boolean
  keyConfigured: boolean
  t: Translate
}
