import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@openstage/contracts': pkg('contracts'),
      '@openstage/domain': pkg('domain'),
      '@openstage/storage': fileURLToPath(new URL('../../packages/storage/src/index.browser.ts', import.meta.url)),
      '@openstage/context-engine': pkg('context-engine'),
      '@openstage/gateway': pkg('gateway'),
      '@openstage/inspector': pkg('inspector'),
      '@openstage/memory': pkg('memory'),
      '@openstage/agent': pkg('agent'),
      '@openstage/extensions': pkg('extensions'),
      '@openstage/recipe': pkg('recipe'),
      '@openstage/card-converter': pkg('card-converter'),
    },
  },
  server: { port: 4173, host: '127.0.0.1', strictPort: true },
})
