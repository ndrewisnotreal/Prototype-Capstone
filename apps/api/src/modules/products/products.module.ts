import { Module } from '@nestjs/common'
import { FilesModule } from '../files/files.module.js'
import { ProductsPanelController } from './products.panel.controller.js'
import { ProductsPublicController } from './products.public.controller.js'
import { ProductsService } from './products.service.js'

@Module({
  imports: [FilesModule],
  controllers: [ProductsPublicController, ProductsPanelController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
