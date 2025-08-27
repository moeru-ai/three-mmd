import { defineConfig } from '@moeru/eslint-config'

export default defineConfig({
  pnpm: true,
  react: true,
}, {
  rules: {
    'sonarjs/cognitive-complexity': 'off',
  },
}, {
  ignores: [
    'examples/playground/src/router.ts',
  ],
})
