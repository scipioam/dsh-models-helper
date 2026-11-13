/**
 * Disk-backed download cache for the large public metadata documents.
 *
 * models.dev/api.json is ~6 MB; keeping it parsed in the Host process would
 * pin tens of MB, so the raw text lives on disk and each read parses it,
 * extracts what it needs, and drops the rest. Concurrent callers share one
 * in-flight download.
 */
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface CachedDocument {
  /** Raw response text. */
  text: string
  /** When the cached copy was downloaded (ms since epoch). */
  fetchedAt: number
  /** Whether this call downloaded it. */
  fresh: boolean
  /** Set when the download failed and an older copy was returned instead. */
  staleReason?: string
}

const inflight = new Map<string, Promise<CachedDocument>>()

/**
 * Read `url` through a file cache under `dir`.
 * @param dir - cache directory.
 * @param name - cache file name.
 * @param url - document URL.
 * @param maxAgeMs - age beyond which the copy is downloaded again.
 * @param force - download even when the copy is fresh.
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
  if (!force) {
    try {
      const info = await stat(file)
      if (Date.now() - info.mtimeMs < maxAgeMs) {
        return { text: await readFile(file, 'utf8'), fetchedAt: info.mtimeMs, fresh: false }
      }
    } catch {
      // Missing or unreadable cache: download below.
    }
  }
  const pending = inflight.get(file)
  if (pending !== undefined) return pending
  const task = (async (): Promise<CachedDocument> => {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'dsh-models-helper' },
        signal: AbortSignal.any([AbortSignal.timeout(60_000), ...signal ? [signal] : []]),
      })
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`)
      const text = await response.text()
      await mkdir(dirname(file), { recursive: true })
      const temp = `${file}.${process.pid}.tmp`
      await writeFile(temp, text, 'utf8')
      await rename(temp, file)
      return { text, fetchedAt: Date.now(), fresh: true }
    } catch (error) {
      // Prefer a stale copy over no answer; the caller shows its age.
      try {
        const info = await stat(file)
        return {
          text: await readFile(file, 'utf8'),
          fetchedAt: info.mtimeMs,
          fresh: false,
          staleReason: error instanceof Error ? error.message : String(error),
        }
      } catch {
        throw error
      }
    }
  })().finally(() => { inflight.delete(file) })
  inflight.set(file, task)
  return task
}
