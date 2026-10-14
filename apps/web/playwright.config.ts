import { defineConfig, devices } from '@playwright/test'

// Test e2e alur utama (T-7.3, ADR-0007). Butuh PostgreSQL yang sudah di-migrate + seed (akun pegawai1@ssb.test).
// Server web dan API dipakai ulang bila sudah jalan; kalau belum, dinyalakan dengan `npm run dev`.
// E2E_BASE_URL: jalankan terhadap server lain (mis. staging); webServer tidak dinyalakan.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // stack Docker lokal (docker-compose.prod.yml, SITE_ADDRESS=localhost) memakai sertifikat lokal Caddy
    ignoreHTTPSErrors: BASE_URL.startsWith('https://localhost'),
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'npm run dev -w apps/api',
          cwd: '../..',
          url: `${API_URL}/api/health`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev -w apps/web',
          cwd: '../..',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
})
