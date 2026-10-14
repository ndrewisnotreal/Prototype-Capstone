import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Test memakai database yang sama dengan .env, tapi schema Postgres terpisah (`e2e`),
// supaya data dev (hasil seed) tidak ikut terhapus atau tercampur.
export function loadTestEnv() {
  if (existsSync('.env')) process.loadEnvFile('.env')
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET ??= 'test-secret-'.padEnd(40, 'x')
  // foto hasil test tidak mengotori apps/api/uploads
  process.env.UPLOAD_DIR = join(tmpdir(), 'ssb-test-uploads')
  const url = process.env.DATABASE_URL
  if (!url)
    throw new Error('DATABASE_URL belum diisi. Salin apps/api/.env.example ke apps/api/.env')
  const u = new URL(url)
  u.searchParams.set('schema', 'e2e')
  process.env.DATABASE_URL = u.toString()
}
