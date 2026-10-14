import { Module } from '@nestjs/common'
import { CatalogPublicController } from './catalog.public.controller.js'
import { CatalogService } from './catalog.service.js'

@Module({
  controllers: [CatalogPublicController],
  providers: [CatalogService],
})
export class CatalogModule {}
