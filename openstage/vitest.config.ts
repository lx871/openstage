import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@openstage/contracts': pkg('contracts'),
      '@openstage/domain': pkg('domain'),
      '@openstage/storage': pkg('storage'),
      '@openstage/context-engine': pkg('context-engine'),
      '@openstage/gateway': pkg('gateway'),
    },
  },
})