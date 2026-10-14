import { Module } from '@nestjs/common'
import { StoreSettingsOwnerController } from './store-settings.owner.controller.js'
import { StoreSettingsOwnerService } from './store-settings.owner.service.js'
import { StoreSettingsPublicController } from './store-settings.public.controller.js'
import { StoreSettingsService } from './store-settings.service.js'

@Module({
  controllers: [StoreSettingsPublicController, StoreSettingsOwnerController],
  providers: [StoreSettingsService, StoreSettingsOwnerService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
