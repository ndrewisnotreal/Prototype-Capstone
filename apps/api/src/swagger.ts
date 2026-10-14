import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AUTH_COOKIE } from './common/auth/auth.decorators.js'

// Swagger UI di /api/docs untuk mencoba endpoint saat development.
// Login lewat POST /api/auth/login dulu; cookie sesi otomatis ikut di request berikutnya.
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Suwandi SecondBranded API')
    .setVersion('1.0')
    .addCookieAuth(AUTH_COOKIE)
    .addSecurityRequirements('cookie')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  // Kelompokkan per segmen pertama path (/api/panel/orders → "panel/orders", /api/products → "products"), tanpa @ApiTags di tiap controller
  for (const [path, item] of Object.entries(document.paths)) {
    const [, , first, second] = path.split('/')
    const tag = first === 'panel' || first === 'owner' ? `${first}/${second}` : (first ?? 'api')
    for (const op of Object.values(item))
      if (op && typeof op === 'object' && 'responses' in op) op.tags = [tag]
  }
  SwaggerModule.setup('api/docs', app, document)
}
