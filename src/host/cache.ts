/**
 * Disk-backed download cache for the large public metadata documents.
 *
 * models.dev/api.json is ~6 MB; keeping it parsed in the Host process would
 * pin tens of MB, so the raw text lives on disk and each read parses it,
 * extracts what it needs, and drops the rest. Concurrent callers share one
 * in-flight download.
 *
 * Network policy (DESIGN §5.1/§9): a cached copy is never trusted to skip an
 * explicit sync. Forced reads always revalidate with a conditional request
 * (`ETag` / `Last-Modified`); the cache is only a fallback when the network
 * fails, and the caller surfaces the data's real fetch time.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { iso } from './util.ts'

export interface CacheMeta {
  /** When the cached body was originally downloaded (ms). */
  fetchedAt?: number
  /** When the server was last asked successfully (200 or 304). */
  checkedAt?: number
  etag?: string
  lastModified?: string
  /** Error from the last failed attempt, kept for the cache-status panel. */
  lastError?: string
}

export interface CachedDocument {
  /** Raw response text. */
  text: string
  /** When this text was actually fetched (ms since epoch). */
  fetchedAt: number
  /** True when this call validated or downloaded the document online. */
  online: boolean
  /** Set when the download failed and an older copy was returned instead. */
  staleReason?: string
}

const inflight = new Map<string, Promise<CachedDocument>>()

function metaPath(file: string): string {
  return `${file}.meta.json`
}

async function readMeta(file: string): Promise<CacheMeta> {
  try {
    return JSON.parse(await readFile(metaPath(file), 'utf8')) as CacheMeta
  } catch {
    return {}
  }
}

async function writeMeta(file: string, meta: CacheMeta): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${metaPath(file)}.${process.pid}.tmp`
  await writeFile(temp, `${JSON.stringify(meta)}\n`, 'utf8')
  await rename(temp, metaPath(file))
}

async function readCachedBody(file: string): Promise<{ text: string; fetchedAt: number } | undefined> {
  try {
    const [text, meta, info] = await Promise.all([readFile(file, 'utf8'), readMeta(file), stat(file)])
    return { text, fetchedAt: meta.fetchedAt ?? info.mtimeMs }
  } catch {
    return undefined
  }
}

/**
 * Read `url` through a file cache under `dir`.
 *
 * @param force - revalidate online even when the copy is fresh. Explicit sync
 *   actions always pass true; that is the plugin's network policy.
 */
export async function cachedFetch(
  dir: string,
  name: string,
  url: string,
  maxAgeMs: number,
  force = false,
  signal?: AbortSignal,
): Promise<CachedDocument> {
  const file = join(dir, name)
  const meta = await readMeta(file)
  if (!force) {
    const cached = await readCachedBody(file)
    if (cached !== undefined && Date.now() - cached.fetchedAt < maxAgeMs) {
      return { ...cached, online: false }
    }
  }
  const pending = inflight.get(file)
  if (pending !== undefined) return pending
  const task = (async (): Promise<CachedDocument> => {
    try {
      const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'dsh-models-helper' }
      if (meta.etag !== undefined) headers['if-none-match'] = meta.etag
      if (meta.lastModified !== undefined) headers['if-modified-since'] = meta.lastModified
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.any([AbortSignal.timeout(60_000), ...signal ? [signal] : []]),
      })
      if (response.status === 304) {
        const cached = await readCachedBody(file)
        if (cached === undefined) throw new Error(`GET ${url}: 304 without a cached copy`)
        await writeMeta(file, { ...meta, checkedAt: Date.now(), lastError: undefined })
        return { text: cached.text, fetchedAt: cached.fetchedAt, online: true }
      }
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`)
      const text = await response.text()
      await mkdir(dirname(file), { recursive: true })
      const temp = `${file}.${process.pid}.tmp`
      await writeFile(temp, text, 'utf8')
      await rename(temp, file)
      const now = Date.now()
      await writeMeta(file, {
        fetchedAt: now,
        checkedAt: now,
        ...response.headers.get('etag') === null ? {} : { etag: response.headers.get('etag') as string },
        ...response.headers.get('last-modified') === null ? {} : { lastModified: response.headers.get('last-modified') as string },
        lastError: undefined,
      })
      return { text, fetchedAt: now, online: true }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const cached = await readCachedBody(file)
      if (cached === undefined) throw error
      await writeMeta(file, { ...meta, checkedAt: Date.now(), lastError: reason })
      // Prefer a stale copy over no answer; the caller shows its age.
      return { ...cached, online: false, staleReason: reason }
    }
  })().finally(() => { inflight.delete(file) })
  inflight.set(file, task)
  return task
}

export interface CacheEntryView {
  fetchedAt?: string
  checkedAt?: string
  staleReason?: string
  size?: number
}

/** Describe one cached document without touching the network. */
export async function readCacheEntry(dir: string, name: string): Promise<CacheEntryView> {
  const file = join(dir, name)
  const meta = await readMeta(file)
  try {
    const info = await stat(file)
    return {
      ...meta.fetchedAt === undefined ? {} : { fetchedAt: iso(meta.fetchedAt) },
      ...meta.checkedAt === undefined ? {} : { checkedAt: iso(meta.checkedAt) },
      ...meta.lastError === undefined ? {} : { staleReason: meta.lastError },
      size: info.size,
    }
  } catch {
    return meta.lastError === undefined ? {} : { staleReason: meta.lastError }
  }
}
