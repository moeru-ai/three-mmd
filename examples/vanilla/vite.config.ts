import { resolve } from 'node:path'

import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  build: {
    rolldownOptions: {
      input: {
        'main': resolve(import.meta.dirname, 'index.html'),
        'three-mmd': resolve(import.meta.dirname, 'three-mmd.html'),
        'three-stdlib': resolve(import.meta.dirname, 'three-stdlib.html'),
      },
    },
  },
})
