import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachedFetch, readCacheEntry } from '../src/host/cache.ts'

const dirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dmh-cache-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

function jsonResponse(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers })
}

describe('cachedFetch', () => {
  it('downloads and caches a document with its validators', async () => {
    const dir = await tempDir()
    const fetchMock = vi.fn(async () => jsonResponse('{"a":1}', 200, { etag: '"v1"', 'last-modified': 'Mon, 01 Jan 2026 00:00:00 GMT' }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)
    expect(first).toMatchObject({ text: '{"a":1}', online: true })
    expect(first.staleReason).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const entry = await readCacheEntry(dir, 'doc.json')
    expect(entry.size).toBeGreaterThan(0)
    expect(entry.fetchedAt).toBeDefined()
    expect(entry.checkedAt).toBeDefined()
    expect(entry.staleReason).toBeUndefined()
  })

  it('treats a 304 as an online success and keeps the data fetch time', async () => {
    const dir = await tempDir()
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.['if-none-match']).toBe('"v1"')
      return new Response(null, { status: 304 })
    })
    const seed = vi.fn(async () => jsonResponse('{"a":1}', 200, { etag: '"v1"' }))
    vi.stubGlobal('fetch', seed)
    const first = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)

    vi.stubGlobal('fetch', fetchMock)
    const second = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)
    expect(second.online).toBe(true)
    expect(second.text).toBe('{"a":1}')
    expect(second.fetchedAt).toBe(first.fetchedAt)
    expect(second.staleReason).toBeUndefined()
    const entry = await readCacheEntry(dir, 'doc.json')
    expect(entry.checkedAt).toBeDefined()
  })

  it('falls back to the cached copy when the network fails', async () => {
    const dir = await tempDir()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('old-body', 200)))
    const first = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline boom') }))
    const fallback = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)
    expect(fallback.online).toBe(false)
    expect(fallback.text).toBe('old-body')
    expect(fallback.fetchedAt).toBe(first.fetchedAt)
    expect(fallback.staleReason).toContain('offline boom')
    const entry = await readCacheEntry(dir, 'doc.json')
    expect(entry.staleReason).toContain('offline boom')
  })

  it('fails loudly when the network fails and no cached copy exists', async () => {
    const dir = await tempDir()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no route') }))
    await expect(cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)).rejects.toThrow('no route')
  })

  it('serves a fresh cached copy without touching the network when not forced', async () => {
    const dir = await tempDir()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('fresh', 200)))
    await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)

    const fetchMock = vi.fn(async () => { throw new Error('must not be called') })
    vi.stubGlobal('fetch', fetchMock)
    const served = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, false)
    expect(served.online).toBe(false)
    expect(served.text).toBe('fresh')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('revalidates online when a non-forced read is stale', async () => {
    const dir = await tempDir()
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('old', 200)))
    await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 60_000, true)

    const fetchMock = vi.fn(async () => jsonResponse('new', 200))
    vi.stubGlobal('fetch', fetchMock)
    const served = await cachedFetch(dir, 'doc.json', 'https://example.test/doc', 0, false)
    expect(served.online).toBe(true)
    expect(served.text).toBe('new')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports an empty cache entry without a network call', async () => {
    const dir = await tempDir()
    await expect(readCacheEntry(dir, 'missing.json')).resolves.toEqual({})
  })
})
