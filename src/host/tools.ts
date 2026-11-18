/**
 * M3 agent tools: the same Host operations the Models page calls, exposed to
 * the model with bounded results. `models_helper_apply` is gated by a
 * `tools/pre-execute` ask; the registry resolves it through `ctx.approval`,
 * so a deployment without an approval channel fails closed.
 */
import type {
  HostContext,
  PendingToolCall,
  PreToolDecision,
  ToolContentBlock,
  ToolDefinition,
} from './dsh.ts'
import type {
  ApplyResult,
  ApplySelection,
  DiffResult,
  ModelFieldName,
} from '../shared/rpc.ts'
import { MODEL_FIELDS } from '../shared/rpc.ts'
import { defaultApplySelection } from '../shared/selection.ts'
import { bindingApply, bindingDiff, helperStatus, readRecentDiff } from './actions.ts'
import { RpcError } from './rpc.ts'
import { countSelection, summaryOfCheck, summaryOfStatus } from './tool-summary.ts'

export const STATUS_TOOL = 'models_helper_status'
export const CHECK_TOOL = 'models_helper_check'
export const APPLY_TOOL = 'models_helper_apply'

interface ApplyToolArgs {
  route: string
  revision: number
  accept?: 'recommended'
  selection?: ApplySelection[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function renderJson(_args: unknown, value: unknown): ToolContentBlock[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

/**
 * Model-facing error text: the Host messages are Chinese diagnostics for the
 * UI and logs, while tool errors should be actionable English. The stable code
 * is preserved so a caller can still branch on it.
 */
const TOOL_ERROR_TEXT: Readonly<Record<string, string>> = {
  'models-helper/refresh-required': 'The diff is no longer available. Call models_helper_check first, then apply with its revision.',
  'models-helper/revision': 'The configuration changed since the check. Call models_helper_check again and apply the new revision.',
  'models-helper/not-bound': 'That provider has no metadata source bound. Bind a source in Settings → Models first.',
  'models-helper/bad-request': 'The arguments were rejected; check the tool parameters.',
  'models-helper/selection-invalid': 'The selection does not match the latest diff. Call models_helper_check again and use the suggested selection or a subset of its rows.',
  'models-helper/no-selection': 'There is nothing to apply for that route.',
  'models-helper/write-failed': 'Writing the provider configuration failed. Check the Host log for details.',
  'models-helper/unavailable': 'A required service is unavailable; reload the plugin or DSH.',
  'models-helper/source-failed': 'Fetching the metadata source failed; retry later.',
  'models-helper/empty-route': 'Applying would leave the route with no models, so it was cancelled.',
}

function toolFailure(error: unknown): Error {
  if (error instanceof RpcError) {
    const text = TOOL_ERROR_TEXT[error.code] ?? 'The models helper operation failed.'
    return new Error(`${text} (${error.code})`)
  }
  return error instanceof Error ? error : new Error(String(error))
}

async function runTool<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    throw toolFailure(error)
  }
}

function parseCheckArgs(raw: unknown): { route?: string } {
  const args = asRecord(raw)
  if (args === undefined) throw new RpcError('models-helper/bad-request', 'check 参数无效')
  if (args.route === undefined) return {}
  if (typeof args.route !== 'string' || args.route.length === 0) {
    throw new RpcError('models-helper/bad-request', 'route 参数无效')
  }
  return { route: args.route }
}

function parseSelection(value: unknown): ApplySelection[] {
  if (!Array.isArray(value)) throw new RpcError('models-helper/bad-request', 'selection 参数无效')
  return value.map((item) => {
    const row = asRecord(item)
    if (row === undefined) throw new RpcError('models-helper/bad-request', 'selection 项无效')
    if (typeof row.id !== 'string' || row.id.length === 0) throw new RpcError('models-helper/bad-request', 'selection.id 无效')
    if (row.mode !== 'add' && row.mode !== 'update' && row.mode !== 'remove') {
      throw new RpcError('models-helper/bad-request', 'selection.mode 无效')
    }
    if (row.fields === undefined) return { id: row.id, mode: row.mode }
    if (!Array.isArray(row.fields) || row.fields.some(field => typeof field !== 'string' || !MODEL_FIELDS.includes(field as ModelFieldName))) {
      throw new RpcError('models-helper/bad-request', 'selection.fields 无效')
    }
    return { id: row.id, mode: row.mode, fields: row.fields as ModelFieldName[] }
  })
}

function parseApplyArgs(raw: unknown): ApplyToolArgs {
  const args = asRecord(raw)
  if (args === undefined) throw new RpcError('models-helper/bad-request', 'apply 参数无效')
  if (typeof args.route !== 'string' || args.route.length === 0) {
    throw new RpcError('models-helper/bad-request', 'route 参数无效')
  }
  if (typeof args.revision !== 'number' || !Number.isFinite(args.revision)) {
    throw new RpcError('models-helper/bad-request', 'revision 参数无效')
  }
  if (args.accept !== undefined && args.accept !== 'recommended') {
    throw new RpcError('models-helper/bad-request', 'accept 参数无效')
  }
  if (args.accept !== undefined && args.selection !== undefined) {
    throw new RpcError('models-helper/bad-request', 'accept 与 selection 不能同时提供')
  }
  const selection = args.selection === undefined ? undefined : parseSelection(args.selection)
  return {
    route: args.route,
    revision: args.revision,
    ...args.accept === 'recommended' ? { accept: 'recommended' as const } : {},
    ...selection === undefined ? {} : { selection },
  }
}

function routeOf(raw: unknown): string | undefined {
  const args = asRecord(raw)
  const route = args?.route
  return typeof route === 'string' && route.length > 0 ? route : undefined
}

function selectionOf(raw: unknown): ApplySelection[] | undefined {
  const args = asRecord(raw)
  if (!Array.isArray(args?.selection)) return undefined
  const selection: ApplySelection[] = []
  for (const item of args.selection) {
    const row = asRecord(item)
    if (row === undefined || typeof row.id !== 'string') continue
    if (row.mode !== 'add' && row.mode !== 'update' && row.mode !== 'remove') continue
    const fields = Array.isArray(row.fields)
      ? row.fields.filter((field): field is ModelFieldName => typeof field === 'string' && MODEL_FIELDS.includes(field as ModelFieldName))
      : undefined
    selection.push({ id: row.id, mode: row.mode, ...fields === undefined ? {} : { fields } })
  }
  return selection
}

/** Build the approval question without trusting an invalid selection. */
function askDecision(raw: unknown): PreToolDecision {
  const route = routeOf(raw)
  const label = route ?? 'the selected provider'
  const explicit = selectionOf(raw)
  const recent = route === undefined ? undefined : readRecentDiff(route)
  const selection = explicit ?? (recent === undefined ? [] : defaultApplySelection(recent.diff))
  const counts = countSelection(selection)
  const en = `Apply model changes to ${label}: ${counts.add} added, ${counts.update} updated (${counts.fields} fields), ${counts.remove} removed.`
  const zh = `将模型更改应用到 ${label}：新增 ${counts.add} 个、更新 ${counts.update} 个（${counts.fields} 个字段）、删除 ${counts.remove} 个。`
  return { kind: 'ask', reason: en, displayReason: { en, zh } }
}

function statusTool(ctx: HostContext): ToolDefinition {
  return {
    name: STATUS_TOOL,
    description: 'List configured pi-ai model providers, their metadata-source bindings, template availability, cached source fetch times, and the current default model. Reads local state only.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    execute: () => runTool(async () => summaryOfStatus(await helperStatus(ctx))),
  }
}

function checkTool(ctx: HostContext): ToolDefinition {
  return {
    name: CHECK_TOOL,
    description: 'Check one bound provider, or every bound provider when route is omitted, for model and field changes from models.dev or OpenRouter. Fetches the source online and falls back to cached data on failure, refreshing the local price snapshot. Returns grouped changes, the diff revision, and a recommended selection. Does not change provider configuration.',
    parameters: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description: 'Provider route id, such as openrouter-custom. Omit to check every bound provider.',
        },
      },
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    execute: raw => runTool(async () => {
      const args = parseCheckArgs(raw)
      const result: DiffResult = await bindingDiff(ctx, args.route === undefined ? {} : { route: args.route })
      return summaryOfCheck(result)
    }),
  }
}

function applyTool(ctx: HostContext): ToolDefinition {
  return {
    name: APPLY_TOOL,
    description: 'Apply a checked diff to one provider model list. Use the revision returned by models_helper_check; the call asks the user for approval before writing. Pass accept="recommended" for the recommended selection, or an explicit selection from the latest diff.',
    parameters: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description: 'Provider route id whose checked diff should be applied.',
        },
        revision: {
          type: 'number',
          description: 'The revision returned by the most recent models_helper_check for this route.',
        },
        accept: {
          type: 'string',
          enum: ['recommended'],
          description: 'Apply the same default selection as the Models page. Do not combine with selection.',
        },
        selection: {
          type: 'array',
          description: 'Explicit rows from the latest diff. Do not combine with accept.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Model id from the diff.' },
              mode: { type: 'string', enum: ['add', 'update', 'remove'], description: 'Row kind from the diff.' },
              fields: {
                type: 'array',
                description: 'For update rows, the fields to take from the source.',
                items: { type: 'string', enum: [...MODEL_FIELDS] },
              },
            },
            required: ['id', 'mode'],
            additionalProperties: false,
          },
        },
      },
      required: ['route', 'revision'],
      additionalProperties: false,
    },
    output: { schema: { type: 'object', additionalProperties: true }, render: renderJson },
    execute: raw => runTool(async () => {
      const args = parseApplyArgs(raw)
      const recent = readRecentDiff(args.route)
      if (recent === undefined) {
        throw new RpcError('models-helper/refresh-required', '请先执行检查更新')
      }
      if (args.revision !== recent.revision) {
        throw new RpcError('models-helper/revision', '检查结果已变化，请重新检查更新')
      }
      const selection = args.selection ?? defaultApplySelection(recent.diff)
      if (selection.length === 0) throw new RpcError('models-helper/no-selection', '没有可应用的内容')
      const result: ApplyResult = await bindingApply(ctx, {
        route: args.route,
        revision: args.revision,
        selection,
      })
      return result
    }),
  }
}

/**
 * Register the three tools and the approval gate. Returns one disposer that
 * unregisters both; the caller owns it through the plugin effect.
 */
export function registerAgentTools(ctx: HostContext): () => void {
  const tools = ctx.get('tools')
  if (tools === undefined) return () => undefined
  const disposers: Array<() => void> = []
  for (const definition of [statusTool(ctx), checkTool(ctx), applyTool(ctx)]) {
    try {
      disposers.push(tools.register(definition))
    } catch (error) {
      ctx.logger.warn('models-helper: cannot register tool %s: %s', definition.name, error instanceof Error ? error.message : String(error))
    }
  }
  const off = ctx.on('tools/pre-execute', (exec: PendingToolCall, next: () => Promise<PreToolDecision>) => {
    if (exec.name !== APPLY_TOOL) return next()
    return askDecision(exec.arguments)
  })
  return () => {
    off()
    for (const dispose of disposers) dispose()
  }
}
