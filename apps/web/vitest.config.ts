import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // e2e tests need a running dev server + browser — exclude from the unit test run
    exclude: ['node_modules', 'dist', '.cache', 'src/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/tests/**'],
      lines: 60,
      functions: 60,
      branches: 50,
      statements: 60,
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sweepbot/utils': path.resolve(__dirname, '../../packages/utils/src/index.ts'),
      '@sweepbot/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  server: {
    fs: {
      // Allow Vite to serve files from the monorepo packages folder
      allow: [path.resolve(__dirname, '../..'), __dirname],
    },
  },
})
