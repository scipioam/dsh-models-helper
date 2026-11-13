/** Client locale namespace and dictionaries. `zh` is the key-set source of truth. */

export const NS = 'dsh-models-helper'

export const zh = {
  'title': '模型助手',
  'probe.badge': 'M0 技术验证',
  'probe.card.builtin': '内置供应商',
  'probe.card.declared': '自定义供应商',
  'probe.card.unknown': '类型未知',
  'probe.card.check': '检查模板与来源',
  'probe.card.checking': '检查中…',
  'probe.card.template': '内置模板：{count} 个模型',
  'probe.card.templateNone': '内置目录中没有这个供应商',
  'probe.card.groups': '协议组',
  'probe.card.modelsDev': 'models.dev：{count} 个模型，其中 {extra} 个内置目录没有',
  'probe.card.openrouter': 'OpenRouter 官方：{count} 个模型，其中 {extra} 个内置目录没有',
  'probe.card.extraList': '内置目录没有的模型',
  'probe.footer.title': '模型助手 · 技术验证',
  'probe.footer.refresh': '重新检查',
  'probe.footer.writeTest': '运行写入测试',
  'probe.footer.writeTest.hint': '会临时新增一个名为 models-helper-probe 的供应商再立即删除，并写入再清除本插件的一个字段。',
  'probe.footer.running': '运行中…',
  'probe.footer.routes': 'llm-pi-ai 中已配置 {count} 个供应商（revision {revision}）',
  'probe.ok': '通过',
  'probe.fail': '失败',
  'error': '出错：{message}',
} satisfies Record<string, string>

export type LocaleKey = keyof typeof zh

export const en: Record<LocaleKey, string> = {
  'title': 'Models helper',
  'probe.badge': 'M0 feasibility check',
  'probe.card.builtin': 'Built-in provider',
  'probe.card.declared': 'Custom provider',
  'probe.card.unknown': 'Unknown kind',
  'probe.card.check': 'Check template and sources',
  'probe.card.checking': 'Checking…',
  'probe.card.template': 'Built-in template: {count} models',
  'probe.card.templateNone': 'The installed catalog does not describe this provider',
  'probe.card.groups': 'Protocol groups',
  'probe.card.modelsDev': 'models.dev: {count} models, {extra} not in the installed catalog',
  'probe.card.openrouter': 'OpenRouter API: {count} models, {extra} not in the installed catalog',
  'probe.card.extraList': 'Models missing from the installed catalog',
  'probe.footer.title': 'Models helper · feasibility check',
  'probe.footer.refresh': 'Check again',
  'probe.footer.writeTest': 'Run write test',
  'probe.footer.writeTest.hint': 'Temporarily adds a provider named models-helper-probe and removes it at once, then sets and clears one field of this plugin.',
  'probe.footer.running': 'Running…',
  'probe.footer.routes': '{count} providers configured in llm-pi-ai (revision {revision})',
  'probe.ok': 'OK',
  'probe.fail': 'Failed',
  'error': 'Error: {message}',
}
