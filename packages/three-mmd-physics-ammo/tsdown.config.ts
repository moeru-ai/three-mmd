import { resolve } from 'node:path'

import { defineConfig } from 'tsdown'

const nodeBuiltinsShim = resolve(import.meta.dirname, 'src/node-builtins-shim.ts')

export default defineConfig({
  alias: {
    fs: nodeBuiltinsShim,
    path: nodeBuiltinsShim,
  },
  define: {
    __filename: 'undefined',
    process: 'undefined',
  },
  deps: {
    alwaysBundle: ['ammojs-typed'],
    dts: {
      neverBundle: ['ammojs-typed'],
    },
    onlyBundle: ['ammojs-typed'],
  },
  dts: { build: true },
  entry: './src/index.ts',
  fixedExtension: false,
  minify: true,
  platform: 'browser',
})
