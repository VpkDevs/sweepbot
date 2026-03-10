import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/e2e/**/*.test.ts'],
    globals: true,
    clearMocks: true,
    mockReset: true,
    deps: {
      inline: ['puppeteer'],
    },
    // increase timeout for browser operations
    testTimeout: 30000,
  },
})
