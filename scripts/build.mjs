// Build both halves into lib/. Runs esbuild sequentially in one process to stay light.
import { build } from 'esbuild'

const common = {
  bundle: true,
  logLevel: 'info',
  legalComments: 'none',
  sourcemap: false,
  charset: 'utf8',
}

// Host: one ESM file for Node; schemastery is bundled so the package has no runtime dependencies.
await build({
  ...common,
  entryPoints: ['src/host/index.ts'],
  outfile: 'lib/index.js',
  platform: 'node',
  format: 'esm',
  target: 'node20',
})

// Client: a classic script that registers itself with the page's module loader.
await build({
  ...common,
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  // React is supplied by the module loader at factory time; types only at build time.
  external: ['react'],
})
