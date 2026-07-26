import { defineConfig } from 'vitest/config'

// Unit tests only (lib/**/*.test.ts). Playwright E2E lives in e2e/*.spec.ts
// and is run separately by `test:e2e`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
