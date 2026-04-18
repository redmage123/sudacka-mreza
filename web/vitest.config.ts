import { mergeConfig, defineConfig } from 'vitest/config'
import { resolve } from 'path'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true,
  },
}))
