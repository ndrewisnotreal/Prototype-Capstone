import { execSync } from 'node:child_process'
import { loadTestEnv } from './test-env.js'

// Sekali sebelum semua test: samakan schema `e2e` dengan migrasi terbaru.
export default function setup() {
  loadTestEnv()
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env })
}
