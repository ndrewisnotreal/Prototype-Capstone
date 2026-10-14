import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // dirs: [] sengaja: komponen sendiri di-import manual supaya batas modul terlihat (ADR-0004)
    Components({ dirs: [], resolvers: [PrimeVueResolver()], dts: 'src/components.d.ts' }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { environment: 'jsdom' },
  server: {
    port: 5173,
    // API_URL: bila port 3000 dipakai aplikasi lain, mis. API_URL=http://localhost:3001
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' },
  },
})
