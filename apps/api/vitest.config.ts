import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

export default defineConfig({
  // SWC, bukan esbuild: Nest butuh decorator metadata untuk DI dan ValidationPipe
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    // unit (*.spec.ts di src) dan e2e (*.e2e-spec.ts di test) jalan bersama di `npm test`
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    // e2e berbagi satu database, jadi file test dijalankan berurutan
    fileParallelism: false,
  },
})
