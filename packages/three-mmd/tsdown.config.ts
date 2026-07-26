import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    build: true,
    resolve: [/^babylon-mmd\//],
  },
  entry: {
    'index': './src/index.ts',
    'materials/index': './src/materials/index.ts',
    'materials/toon': './src/materials/toon/index.ts',
  },
})
