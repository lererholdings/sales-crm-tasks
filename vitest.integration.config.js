import { defineConfig } from 'vitest/config'

// Separate from vitest.config.js on purpose: these tests hit the real dev
// database (via DATABASE_URL) and the test auth bypass (via
// TEST_AUTH_BYPASS_SECRET), so they must never run as part of the default
// `npm test` — only explicitly via `npm run test:integration`, where those
// secrets are known to be present (CI, or a developer's own dev env).
export default defineConfig({
  test: {
    include: ['api/**/*.integration.test.js'],
  },
})
