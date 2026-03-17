import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    globals: true,
    reporters: ['verbose'],
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@extension': path.resolve(__dirname, './src'),
    },
  },
})
