/**
 * Vitest Configuration for SweepBot API
 * Configures test runner for unit, integration, and performance tests
 */

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Setup files — must run before any test module is evaluated
    setupFiles: ['./src/__tests__/setup.env.ts'],

    // Global test timeout
    testTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/index.ts', 'src/db/migrations/**'],
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // Globals
    globals: true,

    // Reporter
    reporters: ['verbose'],

    // Mock reset behavior
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src'),
      '@db': path.resolve(__dirname, './src/db'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
})
