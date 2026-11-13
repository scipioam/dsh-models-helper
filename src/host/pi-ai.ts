/**
 * Runtime access to the installed pi-ai model catalog — the "template" that
 * supplies compat switches, thinking-level spellings and catalog prices.
 *
 * pi-ai is a private dependency of `@deepseek-ai/dsh-llm-pi-ai`, not a package
 * a profile plugin can import by name, so it is located through the
 * llm-pi-ai Loader entry: entry → its package directory (profile package
 * lookup) → pi-ai's directory from there (Node lookup order) → the
 * `./providers/*` export → `providers/all.js`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { HostContext } from './dsh.ts'

export const LLM_PI_AI_PACKAGE = '@deepseek-ai/dsh-llm-pi-ai'
export const PI_AI_PACKAGE = '@earendil-works/pi-ai'

/** The structural subset of a pi-ai `Model` this plugin reads. */
export interface PiAiModel {
  id: string
  name?: string
  api: string
  provider: string
  baseUrl?: string
  reasoning?: boolean
  thinkingLevelMap?: Partial<Record<string, string | null>>
  input?: string[]
  cost?: {
    input: number
    output: number
    cacheRead?: number
    cacheWrite?: number
    tiers?: { inputTokensAbove: number; input: number; output: number; cacheRead?: number; cacheWrite?: number }[]
  }
  contextWindow?: number
  maxTokens?: number
  compat?: Record<string, unknown>
  type?: string
}

export interface TemplateCatalog {
  /** Installed pi-ai version. */
  version: string | undefined
  /** Where it was loaded from, for diagnostics. */
  location: string
  /** Every installed provider id. */
  providers(): string[]
  /** Chat models of one provider; empty for an unknown provider. */
  models(provider: string): PiAiModel[]
}

interface ProvidersAllModule {
  builtinProviders(): { id: string }[]
  getBuiltinModels(provider: string): PiAiModel[]
}

/** Walk up `node_modules` directories from `start` looking for `name`. */
function findUpPackage(start: string, name: string): string | undefined {
  let dir = start
  for (;;) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Resolve the directory of `@deepseek-ai/dsh-llm-pi-ai` as the running
 * profile resolves it.
 */
export function locateLlmPiAi(ctx: HostContext): string {
  const editor = ctx.get('configEditor')
  const packages = ctx.get('pluginPackages')
  if (editor === undefined) throw new Error('configEditor service is unavailable')
  if (packages === undefined) throw new Error('pluginPackages service is unavailable')
  const entry = editor.entries().find(row => row.options.name === LLM_PI_AI_PACKAGE)
  if (entry === undefined) throw new Error(`no Loader entry runs ${LLM_PI_AI_PACKAGE}`)
  const baseUrl = entry.parent.tree.ctx.baseUrl
  if (baseUrl === undefined) throw new Error('the llm-pi-ai entry has no resolution base')
  const pkg = packages.packageOf(LLM_PI_AI_PACKAGE, baseUrl)
  if (pkg === undefined) throw new Error(`cannot locate ${LLM_PI_AI_PACKAGE} from ${baseUrl}`)
  return pkg.dir
}

/** Resolve pi-ai's directory starting from llm-pi-ai's directory. */
export function locatePiAi(ctx: HostContext, llmPiAiDir: string): string {
  const parent = pathToFileURL(join(llmPiAiDir, 'package.json')).href
  const viaLookup = ctx.get('pluginPackages')?.packageOf(PI_AI_PACKAGE, parent)?.dir
  const dir = viaLookup ?? findUpPackage(llmPiAiDir, PI_AI_PACKAGE)
  if (dir === undefined) throw new Error(`cannot locate ${PI_AI_PACKAGE} from ${llmPiAiDir}`)
  return dir
}

/** The file `./providers/all` maps to under pi-ai's export map. */
function providersAllFile(piAiDir: string): { file: string; version: string | undefined } {
  const manifest = JSON.parse(readFileSync(join(piAiDir, 'package.json'), 'utf8')) as {
    version?: string
    exports?: Record<string, unknown>
  }
  const pattern = manifest.exports?.['./providers/*']
  const target = typeof pattern === 'string'
    ? pattern
    : typeof pattern === 'object' && pattern !== null
      ? (pattern as Record<string, unknown>).import ?? (pattern as Record<string, unknown>).default
      : undefined
  if (typeof target !== 'string' || !target.includes('*')) {
    throw new Error(`${PI_AI_PACKAGE} exports no "./providers/*" ESM target`)
  }
  const file = join(piAiDir, target.replace('*', 'all'))
  if (!existsSync(file)) throw new Error(`${file} does not exist`)
  return { file, version: manifest.version }
}

let cached: Promise<TemplateCatalog> | undefined

/**
 * Load the installed pi-ai catalog once per process generation of this
 * plugin. A failure is not cached, so a later call retries.
 */
export function loadTemplateCatalog(ctx: HostContext): Promise<TemplateCatalog> {
  cached ??= (async (): Promise<TemplateCatalog> => {
    const llmDir = locateLlmPiAi(ctx)
    const piDir = locatePiAi(ctx, llmDir)
    const { file, version } = providersAllFile(piDir)
    const mod = await import(pathToFileURL(file).href) as Partial<ProvidersAllModule>
    if (typeof mod.builtinProviders !== 'function' || typeof mod.getBuiltinModels !== 'function') {
      throw new Error(`${file} does not export builtinProviders/getBuiltinModels`)
    }
    const all = mod as ProvidersAllModule
    return {
      version,
      location: file,
      providers: () => all.builtinProviders().map(provider => provider.id),
      models: (provider) => {
        try {
          return all.getBuiltinModels(provider).filter(model => model.type === undefined || model.type === 'chat')
        } catch {
          return []
        }
      },
    }
  })().catch((error: unknown) => {
    cached = undefined
    throw error
  })
  return cached
}

/** Forget the cached catalog (plugin disposal). */
export function resetTemplateCatalog(): void {
  cached = undefined
}
