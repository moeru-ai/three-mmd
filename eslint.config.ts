import { defineConfig } from '@moeru/eslint-config'

export default defineConfig({
  pnpm: true,
  react: true,
}, {
  rules: {
    'sonarjs/aws-restricted-ip-admin-access': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-commented-code': 'off',
  },
}, {
  ignores: [
    'examples/playground/src/router.ts',
  ],
})
