import { Global, Module } from '@nestjs/common'
import { ActivityLogOwnerController } from './activity-log.owner.controller.js'
import { ActivityLogService } from './activity-log.service.js'

// Global: hampir semua aksi pegawai/owner mencatat log
@Global()
@Module({
  controllers: [ActivityLogOwnerController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
