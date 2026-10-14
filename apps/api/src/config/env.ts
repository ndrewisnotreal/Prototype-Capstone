import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://', 'DATABASE_URL harus URL postgresql://'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
  // Alamat web, dipakai untuk tautan di email (reset password)
  APP_URL: z.string().url().default('http://localhost:5173'),
  // Folder file unggahan (foto produk publik, bukti transfer privat). Relatif terhadap apps/api.
  UPLOAD_DIR: z.string().default('uploads'),
  // Jumlah reverse proxy di depan API (Caddy/Nginx = 1). 0 = API diakses langsung.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Chatbot (ADR-0006). Kosong = chatbot otomatis mode FAQ (tanpa AI).
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  // Email (ADR-0009). SMTP_HOST kosong = email hanya dicetak ke log.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Suwandi SecondBranded <no-reply@localhost>'),
})

export type Env = z.infer<typeof envSchema>

// Dipanggil sekali saat start; aplikasi berhenti dengan pesan jelas bila env salah.
export function validateEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`)
    throw new Error(
      `Konfigurasi env tidak valid (lihat apps/api/.env.example):\n${issues.join('\n')}`,
    )
  }
  return result.data
}

let cached: Env | undefined
// Env tervalidasi untuk dipakai di mana saja (main.ts memanggilnya paling awal supaya gagal cepat).
export const getEnv = (): Env => (cached ??= validateEnv(process.env))
