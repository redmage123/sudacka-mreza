import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // E2-19 scope: collection config files + access module + slug/search hooks
      // sendContactEmail requires a live Resend API key — tested in integration suite
      include: [
        'src/collections/**/*.ts',
        'src/hooks/generateSlug.ts',
        'src/hooks/generateSearchIndex.ts',
        'src/access.ts',
        'src/routes/**/*.ts',
      ],
      // contact.ts and rss.ts require live external APIs (Resend/Payload DB)
      // and are tested only in the integration suite — excluded from unit coverage.
      exclude: ['src/tests/**', 'src/routes/contact.ts', 'src/routes/rss.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
