import { defineConfig } from 'tsdown'

export default defineConfig({
  deps: { dts: { alwaysBundle: [/^babylon-mmd\//] } },
  dts: { build: true },
  entry: {
    'index': './src/index.ts',
    'materials/index': './src/materials/index.ts',
    'materials/physical': './src/materials/physical/index.ts',
    'materials/toon': './src/materials/toon/index.ts',
  },
  fixedExtension: false,
})
