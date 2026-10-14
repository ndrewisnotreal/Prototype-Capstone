import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { JwtAuthGuard } from './common/auth/jwt-auth.guard.js'
import { RolesGuard } from './common/auth/roles.guard.js'
import { getEnv } from './config/env.js'
import { HealthController } from './health/health.controller.js'
import { ActivityLogModule } from './modules/activity-log/activity-log.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { CartModule } from './modules/cart/cart.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { ChatbotModule } from './modules/chatbot/chatbot.module.js'
import { OrdersModule } from './modules/orders/orders.module.js'
import { ProductsModule } from './modules/products/products.module.js'
import { ReportsModule } from './modules/reports/reports.module.js'
import { StoreSettingsModule } from './modules/store-settings/store-settings.module.js'
import { UsersModule } from './modules/users/users.module.js'
import { PrismaModule } from './prisma/prisma.module.js'

@Module({
  imports: [
    PrismaModule,
    ActivityLogModule,
    // registerAsync: secret dibaca saat bootstrap, setelah .env dimuat di main.ts
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: getEnv().JWT_SECRET, signOptions: { expiresIn: '7d' } }),
    }),
    AuthModule,
    CartModule,
    CatalogModule,
    ChatbotModule,
    OrdersModule,
    ProductsModule,
    ReportsModule,
    StoreSettingsModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Urutan penting: login dicek dulu, baru role
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
