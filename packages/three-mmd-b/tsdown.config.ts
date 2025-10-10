import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    build: true,
    resolve: [/^babylon-mmd\//],
  },
  entry: ['./src/index.ts'],
})
