import { defineConfig } from '@moeru/eslint-config'

export default defineConfig({
  pnpm: true,
  react: true,
}, {
  rules: {
    'sonarjs/argument-type': 'off',
    'sonarjs/aws-restricted-ip-admin-access': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/jsx-no-leaked-render': 'off',
    'sonarjs/no-commented-code': 'off',
  },
}, {
  ignores: [
    'examples/playground/src/router.ts',
    '.agents',
  ],
})
