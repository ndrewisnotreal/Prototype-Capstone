import { Module } from '@nestjs/common'
import { ReportsOwnerController } from './reports.owner.controller.js'
import { ReportsService } from './reports.service.js'

@Module({
  controllers: [ReportsOwnerController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
