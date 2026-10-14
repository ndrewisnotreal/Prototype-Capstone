import { Controller, Get } from '@nestjs/common'
import { Public } from '../../common/auth/auth.decorators.js'
import { StoreSettingsService } from './store-settings.service.js'

@Public()
@Controller('store')
export class StoreSettingsPublicController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get('official-channels')
  officialChannels() {
    return this.settings.officialChannels()
  }
}
