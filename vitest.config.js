import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    include: ['test/**/*.test.js'],
    exclude: ['test/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['node_modules/', 'test/', 'site/']
    }
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
