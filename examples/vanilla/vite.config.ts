import { resolve } from 'node:path'

import { defineConfig } from 'vite'

const page = (path: string) => resolve(import.meta.dirname, `${path}.html`)

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  build: {
    rolldownOptions: {
      input: {
        'main': page('index'),
        'three-mmd': page('three-mmd'),
        'three-stdlib': page('three-stdlib'),
      },
    },
  },
})
