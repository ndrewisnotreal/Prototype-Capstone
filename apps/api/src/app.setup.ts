import { INestApplication, ValidationPipe } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js'
import { PRODUCT_PHOTO_URL_PREFIX, productPhotoDir } from './modules/files/storage.service.js'

// Dipakai main.ts dan test e2e supaya perilaku test sama dengan aplikasi asli.
// trustProxy: jumlah reverse proxy di depan API (env TRUST_PROXY). Tanpa ini, di belakang proxy semua pengunjung
// terbaca dengan IP proxy dan berbagi satu kuota rate limit chatbot.
export function setupApp(app: INestApplication, { trustProxy = 0 } = {}) {
  if (trustProxy) (app as NestExpressApplication).set('trust proxy', trustProxy)
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  // Hanya foto produk yang publik. Bukti transfer disimpan di folder lain dan dilayani lewat endpoint ber-guard.
  ;(app as NestExpressApplication).useStaticAssets(productPhotoDir(), {
    prefix: PRODUCT_PHOTO_URL_PREFIX,
    index: false,
    maxAge: '7d',
  })
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  return app
}
