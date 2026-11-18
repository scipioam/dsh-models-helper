import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RPC_ERROR_CODES, errorCodeKey } from '../src/shared/errors.ts'
import { en, zh } from '../src/client/locales.ts'
import { errorText } from '../src/client/errors.ts'

const root = process.cwd()

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFiles(path))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path)
  }
  return files
}

const zhDict = zh as Record<string, string>
const enDict = en as Record<string, string>

describe('locale dictionaries', () => {
  it('have the same key set', () => {
    expect(Object.keys(zhDict).sort()).toEqual(Object.keys(enDict).sort())
  })

  it('localize every RPC error code the source can emit', async () => {
    const files = [
      ...await sourceFiles(join(root, 'src/host')),
      ...await sourceFiles(join(root, 'src/client')),
    ]
    const seen = new Set<string>()
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      for (const match of text.matchAll(/models-helper\/[a-z-]+/g)) seen.add(match[0])
    }
    expect(seen.size).toBeGreaterThan(0)
    for (const code of seen) {
      expect(RPC_ERROR_CODES.some(row => row === code), `undeclared code ${code}`).toBe(true)
      const key = `errorCode.${errorCodeKey(code)}`
      expect(zhDict[key], `missing zh ${key}`).toBeTypeOf('string')
      expect(enDict[key], `missing en ${key}`).toBeTypeOf('string')
    }
    for (const code of RPC_ERROR_CODES) {
      const key = `errorCode.${errorCodeKey(code)}`
      expect(zhDict[key], `missing zh ${key}`).toBeTypeOf('string')
      expect(enDict[key], `missing en ${key}`).toBeTypeOf('string')
    }
  })
})

describe('errorText', () => {
  const t = (key: string, params?: Record<string, string | number>): string => {
    const template = zhDict[key]
    if (template === undefined) return key
    return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? `{${name}}`))
  }

  it('uses the stable code message instead of the Chinese Host message', () => {
    const text = errorText(t, { code: 'models-helper/not-bound', message: '尚未绑定参数来源', details: {} })
    expect(text).toBe(zhDict['errorCode.not-bound'])
    expect(text).not.toContain('尚未绑定')
  })

  it('falls back to a code-bearing generic message for unknown codes', () => {
    const text = errorText(t, { code: 'models-helper/never-heard-of-it', message: 'x', details: {} })
    expect(text).toContain('models-helper/never-heard-of-it')
  })
})
