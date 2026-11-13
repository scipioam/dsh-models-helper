/**
 * The page's React, supplied by the Client module table when the factory runs.
 * Every TSX file imports this binding; esbuild compiles JSX to
 * `React.createElement`, so the live binding is read at render time.
 */
import type * as ReactNS from 'react'

export let React: typeof ReactNS = undefined as unknown as typeof ReactNS

export function setReact(value: typeof ReactNS): void {
  React = value
}
