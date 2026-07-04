import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/**/*.test.js', 'lib/**/*.test.js'],
    exclude: ['api/**/*.integration.test.js', 'node_modules/**'],
  },
})
