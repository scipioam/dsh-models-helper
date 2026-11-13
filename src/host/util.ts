/** Small shared helpers for the pure engines (no I/O). */

/** Structural equality for JSON values (plain objects, arrays, primitives). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every(key => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
}

/** Deep clone of a JSON value. */
export function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `2026-11-13T06:24:55.000Z` for a millisecond timestamp. */
export function iso(ms: number): string {
  return new Date(ms).toISOString()
}
